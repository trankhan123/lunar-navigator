import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import { getChatSession, QUOTA_SCRIPT } from './chatQuota.js'

test('signed session persists, tampering replaces it, production cookie is Secure', () => {
  const env = { CHAT_SESSION_SECRET: 'synthetic-secret-for-cookie-test-only', VERCEL: '1' }
  let cookie
  const res = { setHeader: (_key, value) => { cookie = value } }
  const id = getChatSession({ headers: {} }, res, env)
  const saved = cookie.split(';')[0]
  assert.match(cookie, /; Secure$/)
  assert.equal(getChatSession({ headers: { cookie: saved } }, res, env), id)
  const tampered = saved.slice(0, -1) + (saved.endsWith('0') ? '1' : '0')
  assert.notEqual(getChatSession({ headers: { cookie: tampered } }, res, env), id)
})

const exec = promisify(execFile)
test('actual Redis EVAL atomically caps concurrent reservations and deduplicates', {
  skip: !process.env.REDIS_SERVER_BIN || !process.env.REDIS_CLI_BIN,
}, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'mission-chat-redis-'))
  const socket = join(directory, 'redis.sock')
  const server = spawn(process.env.REDIS_SERVER_BIN, ['--port', '0', '--unixsocket', socket,
    '--save', '', '--appendonly', 'no', '--dir', directory], { stdio: 'ignore' })
  const stopped = once(server, 'exit')
  t.after(async () => { server.kill('SIGTERM'); await stopped; await rm(directory, { recursive: true, force: true }) })
  const command = async (...args) => (await exec(process.env.REDIS_CLI_BIN, ['-s', socket, '--raw', ...args.map(String)])).stdout.trim()
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if (await command('PING') === 'PONG') break } catch { /* Wait only for this temporary test server. */ }
    await delay(20)
  }
  const keys = ['day', 'minute', 'ip-minute', 'ip-day', 'session-day']
  const reserve = (id) => command('EVAL', QUOTA_SCRIPT, 6, `request-${id}`, ...keys, 3, 172800, 100, 120, 100, 120, 100, 172800, 100, 172800)
  const results = await Promise.all(Array.from({ length: 20 }, (_, id) => reserve(id)))
  assert.equal(results.filter((result) => result === '1').length, 3)
  assert.equal(results.filter((result) => result === '-1').length, 17)
  assert.equal(await command('GET', 'day'), '3')
  const accepted = results.indexOf('1')
  assert.equal(await reserve(accepted), '-2')
  assert.equal(await command('GET', 'day'), '3')
  assert.ok(Number(await command('TTL', 'day')) > 0)
  assert.ok(Number(await command('TTL', `request-${accepted}`)) > 0)
})
