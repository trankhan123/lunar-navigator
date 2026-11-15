// Run against npm run dev. Supply a locally installed Playwright module path;
// this regression check adds no application dependency and makes no Gemini calls.
import assert from 'node:assert/strict'
import { prepareChatDraft } from '../src/core/missionChat.js'
import { getChatCatalog } from '../server/chatCatalog.js'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  headless: true, args: ['--no-sandbox'],
})
const catalog = getChatCatalog()
try {
  for (const failure of ['429', '502', 'network', 'invalid-json', 'incomplete-draft']) {
    const page = await browser.newPage()
    let calls = 0
    await page.route('**/api/mission-chat', async (route) => {
      const body = route.request().postDataJSON()
      calls++
      if (calls === 2) {
        if (failure === 'network') return route.abort('failed')
        if (failure === 'invalid-json') return route.fulfill({ status: 200, contentType: 'application/json', body: '{' })
        if (failure === 'incomplete-draft') return route.fulfill({ json: { message: 'Incomplete.' } })
        return route.fulfill({ status: Number(failure), json: { error: 'Synthetic service failure.' } })
      }
      if (calls === 3) {
        // A failed correction must not lose the preceding draft's mission context.
        assert.equal(body.scenario.batteryCapacityWh, 2500)
        assert.equal(body.scenario.currentPoint.siteId, 'malapert-massif')
      }
      const patch = calls === 1 ? {
        currentPoint: { type: 'site', siteId: 'malapert-massif' },
        batteryCapacityWh: { value: 2.5, unit: 'kWh' },
      } : calls === 3 ? { batteryCapacityWh: { value: 5, unit: 'kWh' } } : {}
      return route.fulfill({ json: prepareChatDraft({
        message: calls === 4 ? 'I can only help prepare a lunar mission form.' : 'Review the mission draft.',
        questions: [], patch,
      }, body.scenario, catalog) })
    })
    await page.goto(process.env.CHAT_TEST_URL || 'http://127.0.0.1:5187/?screen=map')
    const input = page.getByLabel('Your mission or a clarification')
    const send = page.getByRole('button', { name: 'Send message', exact: true })
    const apply = page.getByRole('button', { name: 'Apply draft to form' })
    await input.fill('At Malapert Massif, use a 2.5 kWh battery.')
    await send.click()
    await page.getByRole('heading', { name: 'Review mission draft' }).waitFor()
    assert.equal(await apply.isEnabled(), true)
    await input.fill('Actually change the battery to 5 kWh.')
    await send.click()
    await page.getByRole('alert').waitFor()
    assert.equal(await apply.isDisabled(), true, failure)
    assert.equal(await input.inputValue(), 'Actually change the battery to 5 kWh.')
    await page.getByText('This draft predates your latest message.', { exact: false }).waitFor()
    await send.click()
    await page.getByRole('alert').waitFor({ state: 'hidden' })
    await send.waitFor()
    await page.getByText('This draft predates your latest message.', { exact: false }).waitFor({ state: 'hidden' })
    assert.equal(await apply.isEnabled(), true)
    await apply.click()
    assert.equal(await page.getByLabel('Battery capacity (kWh)').inputValue(), '5')
    await input.fill('Write a shoe sales email.')
    await send.click()
    await page.getByText('I can only help prepare a lunar mission form.', { exact: true }).waitFor()
    assert.equal(await apply.isDisabled(), true)
    await page.getByText('No mission parameters were proposed.', { exact: false }).waitFor()
    assert.equal(await page.getByLabel('Battery capacity (kWh)').inputValue(), '5')
    await page.close()
    console.log(`PASS: ${failure} correction, successful retry, and empty-patch refusal`)
  }
} finally { await browser.close() }
