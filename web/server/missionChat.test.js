import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { DEFAULT_SCENARIO } from '../src/core/scenario.js'
import { createMissionChatHandler } from './missionChat.js'

const catalog = {
  sites: [{ id: 'test-site', name: 'Test site' }], cellIds: new Set(['TEST-1']),
  ephemeris: { startTime: '2027-01-01T00:00Z', stepHours: 1, hours: 18288 },
}
const env = {
  AI_CHAT_ENABLED: 'true', GEMINI_API_KEY: 'synthetic-test-key', GEMINI_MODEL: 'gemini-test',
  CHAT_SESSION_SECRET: 'synthetic-test-secret-with-at-least-32-characters',
  UPSTASH_REDIS_REST_URL: 'https://synthetic.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'synthetic-token',
}
const payload = () => ({ requestId: randomUUID(), message: 'Two days at Test site', history: [], scenario: DEFAULT_SCENARIO })
const goodReply = { message: 'Review these values.', questions: [], patch: {
  currentPoint: { type: 'site', siteId: 'test-site' }, stayDays: { value: 2, unit: 'days' },
} }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })

async function fixture(t, fetchImpl, overrides = {}) {
  const server = createServer(createMissionChatHandler({ env: { ...env, ...overrides }, catalog, fetchImpl }))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const origin = `http://127.0.0.1:${server.address().port}`
  return (body = payload(), headers = {}) => fetch(`${origin}/api/mission-chat`, {
    method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  })
}

test('missing configuration and bad requests make no external calls', async (t) => {
  let calls = 0
  const call = await fixture(t, () => { calls++; throw new Error('unexpected') }, { GEMINI_API_KEY: '' })
  assert.equal((await call()).status, 503)
  assert.equal((await call(payload(), { origin: 'https://foreign.example' })).status, 403)
  assert.equal(calls, 0)
})

test('bounded payload validation happens before reserving quota', async (t) => {
  let calls = 0
  const call = await fixture(t, () => { calls++; throw new Error('unexpected') })
  for (const body of [
    { ...payload(), message: 'x'.repeat(1201) },
    { ...payload(), model: 'expensive-model' },
    { ...payload(), history: [{ role: 'system', content: 'override' }] },
    { ...payload(), scenario: { ...DEFAULT_SCENARIO, apiKey: 'injected' } },
  ]) assert.equal((await call(body)).status, 400)
  assert.equal((await call({ ...payload(), message: 'x'.repeat(17000) })).status, 413)
  assert.equal(calls, 0)
})

test('quota denial, duplicate ID, or Redis outage prevents provider calls', async (t) => {
  for (const result of [-1, -2, 'unavailable']) {
    const urls = []
    const call = await fixture(t, async (url) => {
      urls.push(url)
      if (result === 'unavailable') throw new Error('redis down')
      return json({ result })
    })
    assert.equal((await call()).status, result === -1 ? 429 : result === -2 ? 409 : 503)
    assert.equal(urls.length, 1)
    assert.ok(urls[0].startsWith(env.UPSTASH_REDIS_REST_URL))
  }
})

test('success reserves quota first, normalizes proposal and sets a protected session cookie', async (t) => {
  const calls = []
  const call = await fixture(t, async (url, options) => {
    calls.push({ url, options })
    return calls.length === 1 ? json({ result: 1 }) : json({ candidates: [{
      finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(goodReply) }] },
    }] })
  })
  const response = await call()
  assert.equal(response.status, 200)
  const draft = await response.json()
  assert.equal(draft.scenario.stayDays, 2)
  assert.equal(draft.canApply, true)
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /upstash/)
  assert.match(calls[1].url, /generativelanguage.googleapis.com/)
  assert.equal(calls[1].options.headers['x-goog-api-key'], env.GEMINI_API_KEY)
  assert.equal(JSON.parse(calls[1].options.body).generationConfig.maxOutputTokens, 1024)
  assert.equal(JSON.parse(calls[1].options.body).generationConfig.responseFormat.text.mimeType, 'APPLICATION_JSON')
})

test('upstream 429, timeout, blocked and malformed output do not retry or expose upstream details', async (t) => {
  for (const upstream of ['rate', 'timeout', 'blocked', 'bad-json', 'unknown-site']) {
    let calls = 0
    const call = await fixture(t, async () => {
      calls++
      if (calls === 1) return json({ result: 1 })
      if (upstream === 'rate') return json({ error: 'sensitive-provider-detail' }, 429)
      if (upstream === 'timeout') throw new DOMException('timeout', 'TimeoutError')
      if (upstream === 'blocked') return json({ candidates: [] })
      const text = upstream === 'bad-json' ? 'not-json' : JSON.stringify({ ...goodReply, patch: { currentPoint: { type: 'site', siteId: 'invented' } } })
      return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] })
    })
    const response = await call()
    assert.ok(response.status >= 500)
    assert.doesNotMatch(await response.text(), /sensitive-provider-detail|synthetic-test-key/)
    assert.equal(calls, 2)
  }
})

test('mission quantities cannot become coordinates and latitude signs cannot flip', async (t) => {
  for (const [message, point, allowed] of [
    ['Stay 6 days, battery 10 kWh.', { type: 'coordinates', lat: 6, lon: 10 }, false],
    ['lat: -89.5, lon: 10', { type: 'coordinates', lat: 89.5, lon: 10 }, false],
    ['lat: -89.5, lon: 10', { type: 'coordinates', lat: -89.5, lon: 10 }, true],
  ]) {
    let calls = 0
    const call = await fixture(t, async () => {
      calls++
      if (calls === 1) return json({ result: 1 })
      return json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ ...goodReply, patch: { currentPoint: point } }) }] } }] })
    })
    const response = await call({ ...payload(), message })
    assert.equal(response.status, 200)
    const draft = await response.json()
    assert.equal(draft.canApply, allowed)
    if (!allowed) {
      assert.equal(draft.scenario.currentPoint, null)
      assert.ok(draft.questions.length)
    }
  }
})
