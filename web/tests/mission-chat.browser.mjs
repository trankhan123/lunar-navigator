// Run against VITE_CHAT_UI=true npm run dev. Supply a locally installed Playwright module path;
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  let guideCalls = 0
  await page.route('**/api/mission-chat', async (route) => {
    guideCalls++
    const body = route.request().postDataJSON()
    const patch = guideCalls === 1 ? {
      currentPoint: { type: 'site', siteId: 'malapert-massif' },
      startDate: '2028-01-01', endDate: '2028-01-07',
      batteryCapacityWh: { value: 1000, unit: 'Wh' },
      maxDarkHours: { value: 2, unit: 'days' }, loadW: { value: 150, unit: 'W' },
    } : { batteryCapacityWh: { value: -1, unit: 'Wh' } }
    return route.fulfill({ json: prepareChatDraft({ message: 'Review the supplied details.', questions: [], patch }, body.scenario, catalog) })
  })
  await page.goto(process.env.CHAT_TEST_URL || 'http://127.0.0.1:5187/?screen=map')
  const review = (field) => page.locator(`[data-review-field="${field}"]`)
  const guide = (field) => page.locator(`[data-guide-field="${field}"]`)
  await page.getByRole('button', { name: 'Plan with AI', exact: true }).click()
  assert.equal(await page.getByLabel('Your mission or a clarification').evaluate((element) => document.activeElement === element), true)
  assert.match(await review('batteryCapacityWh').innerText(), /Default/)
  await page.getByRole('button', { name: /Help me get started/ }).click()
  await page.locator('#guide-currentPoint').selectOption('malapert-massif')
  await page.locator('#guide-startDate').fill('2028-01-01')
  await page.locator('#guide-endDate').fill('2028-01-07')
  await page.locator('#guide-batteryCapacityWh').fill('1000')
  await page.getByLabel('Maximum night time unit').selectOption('days')
  await page.locator('#guide-maxDarkHours').fill('2')
  assert.match(await guide('batteryCapacityWh').innerText(), /Entered · valid/)
  assert.match(await guide('panelMaxW').innerText(), /Default/)
  await page.locator('#guide-loadW').fill('abc')
  assert.match(await guide('loadW').innerText(), /Invalid/)
  const useDetails = page.getByRole('button', { name: 'Use these details in chat' })
  assert.equal(await useDetails.isDisabled(), true)
  await page.locator('#guide-loadW').fill('')
  assert.match(await guide('loadW').innerText(), /Default/)
  await page.locator('#guide-loadW').fill('150')
  await useDetails.click()
  const message = await page.getByLabel('Your mission or a clarification').inputValue()
  assert.match(message, /Battery capacity: 1000 Wh/)
  assert.match(message, /Maximum night time: 2 days/)
  assert.doesNotMatch(message, /Solar panel power:/)
  assert.equal(guideCalls, 0, 'Generating a guided prompt must not call the API')
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await page.getByRole('heading', { name: 'Review mission draft' }).waitFor()
  assert.match(await review('batteryCapacityWh').innerText(), /Entered · valid/)
  assert.match(await review('maxDarkHours').innerText(), /48 h/)
  assert.match(await review('panelMaxW').innerText(), /Default/)
  await page.getByRole('button', { name: 'Apply draft to form' }).click()
  assert.equal(await page.getByLabel('Battery capacity (kWh)').inputValue(), '1')
  assert.match(await review('batteryCapacityWh').innerText(), /Entered · valid/)
  await page.getByRole('button', { name: 'About', exact: true }).click()
  await page.getByRole('button', { name: 'Map & scenario', exact: true }).click()
  await review('batteryCapacityWh').waitFor()
  assert.match(await review('batteryCapacityWh').innerText(), /Entered · valid/, 'Entered sources survive switching screens')
  await page.getByLabel('Average load (W)').fill('450')
  assert.match(await review('loadW').innerText(), /From form/, 'A manual edit must not inherit the old chat badge')
  await page.getByLabel('Your mission or a clarification').fill('Change battery to -1 Wh')
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await page.getByRole('heading', { name: 'Review mission draft' }).waitFor()
  assert.match(await review('batteryCapacityWh').innerText(), /Invalid/)
  assert.equal(await page.getByRole('button', { name: 'Apply draft to form' }).isDisabled(), true)
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile layout must fit the viewport')
  if (process.env.CHAT_SCREENSHOT) await page.screenshot({ path: process.env.CHAT_SCREENSHOT, fullPage: true })
  await page.close()
  console.log('PASS: guided request, explicit units, no extra API call, default/entered/invalid badges, Apply and mobile width')
  const vietnamese = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await vietnamese.addInitScript(() => localStorage.setItem('lunar_lang', 'vi'))
  await vietnamese.goto(process.env.CHAT_TEST_URL || 'http://127.0.0.1:5187/?screen=map')
  await vietnamese.getByRole('button', { name: 'Lập kế hoạch với AI', exact: true }).click()
  await vietnamese.getByRole('button', { name: /Hướng dẫn tôi bắt đầu/ }).click()
  await vietnamese.locator('#guide-batteryCapacityWh').fill('abc')
  assert.match(await vietnamese.locator('[data-guide-field="batteryCapacityWh"]').innerText(), /Không hợp lệ/)
  assert.equal(await vietnamese.getByRole('button', { name: 'Đưa thông tin này vào chat' }).isDisabled(), true)
  assert.ok(await vietnamese.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  await vietnamese.close()
  console.log('PASS: Vietnamese guided labels, invalid input and mobile layout')
} finally { await browser.close() }
