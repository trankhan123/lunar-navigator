import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

// One transaction across all instances; failed provider calls still consume a reservation.
export const QUOTA_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return -2 end
for i = 2, #KEYS do
  if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[(i-2)*2+1]) then return -1 end
end
for i = 2, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('EXPIRE', KEYS[i], tonumber(ARGV[(i-2)*2+2])) end
end
redis.call('SET', KEYS[1], '1', 'EX', 86400)
return 1
`

const digest = (value, secret) => createHmac('sha256', secret).update(value).digest('hex')

export function getChatSession(req, res, env) {
  const cookie = (req.headers.cookie ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith('lunar_chat='))?.slice(11)
  const now = Math.floor(Date.now() / 1000)
  if (cookie && /^[0-9a-f-]{36}\.\d{10}\.[0-9a-f]{64}$/.test(cookie)) {
    const [id, issued, signature] = cookie.split('.')
    const expected = digest(`${id}.${issued}`, env.CHAT_SESSION_SECRET)
    if (Number(issued) <= now && now - Number(issued) < 86400 &&
        timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return id
  }
  const id = randomUUID()
  const value = `${id}.${now}`
  const secure = env.VERCEL || req.socket?.encrypted
  res.setHeader('Set-Cookie', `lunar_chat=${value}.${digest(value, env.CHAT_SESSION_SECRET)}; Path=/api; Max-Age=86400; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`)
  return id
}

function limit(value, fallback) {
  const number = Number(value ?? fallback)
  if (!Number.isInteger(number) || number < 1 || number > 10000) throw new Error('Invalid limit configuration.')
  return number
}

export async function reserveChatQuota({ req, sessionId, requestId, env, fetchImpl }) {
  const minute = Math.floor(Date.now() / 60000)
  const day = Math.floor(Date.now() / 86400000)
  // Vercel overwrites x-vercel-forwarded-for. Never trust user-supplied x-forwarded-for.
  const ip = env.VERCEL ? String(req.headers['x-vercel-forwarded-for'] ?? 'unknown').split(',')[0].trim() : req.socket?.remoteAddress ?? 'local'
  const ipHash = digest(ip, env.CHAT_SESSION_SECRET).slice(0, 32)
  const prefix = 'lunar-chat:v1'
  const keys = [
    `${prefix}:request:${sessionId}:${requestId}`, `${prefix}:day:${day}`, `${prefix}:minute:${minute}`,
    `${prefix}:ip:${ipHash}:minute:${minute}`, `${prefix}:ip:${ipHash}:day:${day}`, `${prefix}:session:${sessionId}:${day}`,
  ]
  const args = [limit(env.CHAT_GLOBAL_DAILY_LIMIT, 50), 172800, limit(env.CHAT_GLOBAL_MINUTE_LIMIT, 3), 120, 4, 120, 10, 172800, 10, 172800] // per-IP and per-session daily caps of 10 keep the shared 50/day for many visitors
  const response = await fetchImpl(env.UPSTASH_REDIS_REST_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(['EVAL', QUOTA_SCRIPT, keys.length, ...keys, ...args]), signal: AbortSignal.timeout(3000),
  })
  if (!response.ok) throw new Error('Quota service unavailable.')
  const { result, error } = await response.json()
  if (error || ![1, -1, -2].includes(result)) throw new Error('Quota service unavailable.')
  return result
}
