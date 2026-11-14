import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_CONTEXT_VALUE,
  DEFAULT_LANG,
  LANGUAGES,
  TRANSLATIONS,
  interpolate,
  translate,
} from './index.js'

test('i18n: default language is "en"', () => {
  assert.equal(DEFAULT_LANG, 'en')
})

test('i18n: all 7 languages defined with correct groups', () => {
  const codes = Object.keys(LANGUAGES)
  assert.equal(codes.length, 7)
  assert.deepEqual(codes.sort(), ['de', 'en', 'es', 'ja', 'ko', 'ru', 'vi'])

  const primary = Object.values(LANGUAGES).filter((l) => l.group === 'primary').map((l) => l.code)
  const secondary = Object.values(LANGUAGES).filter((l) => l.group === 'secondary').map((l) => l.code)

  assert.deepEqual(primary.sort(), ['en', 'vi'])
  assert.deepEqual(secondary.sort(), ['de', 'es', 'ja', 'ko', 'ru'])
})

test('i18n: parameter interpolation works for single and double braces', () => {
  assert.equal(
    interpolate('Hello {name}!', { name: 'Artemis' }),
    'Hello Artemis!',
  )
  assert.equal(
    interpolate('Evaluating cells {done} / {total}', { done: 12, total: 225 }),
    'Evaluating cells 12 / 225',
  )
  assert.equal(
    interpolate('Value is {{value}} units', { value: 100 }),
    'Value is 100 units',
  )
  // Missing parameter keeps original template
  assert.equal(
    interpolate('Hello {missing}!', {}),
    'Hello {missing}!',
  )
  // Empty or non-string inputs
  assert.equal(interpolate(null, { name: 'A' }), null)
  assert.equal(interpolate('Static text', null), 'Static text')
})

test('i18n: translation resolution and fallback behavior', () => {
  // English lookup
  assert.equal(translate('en', 'header.title'), 'Lunar Landing Site Navigator')

  // Vietnamese lookup
  assert.equal(translate('vi', 'header.title'), 'Bộ định vị bãi đáp Mặt Trăng')

  // Parameter interpolation during translation
  assert.equal(
    translate('en', 'results.summary', { count: 10, steps: 40, days: 6 }),
    '10 cells × 40 landing times, staying 6 days each.',
  )
  assert.equal(
    translate('vi', 'results.summary', { count: 10, steps: 40, days: 6 }),
    '10 ô lưới × 40 thời điểm hạ cánh, lưu trú 6 ngày mỗi lượt.',
  )

  // Fallback to English when key is missing in another language
  const customTranslations = {
    en: { 'test.key': 'English original' },
    vi: {},
  }
  const originalTranslations = { ...TRANSLATIONS }
  try {
    Object.assign(TRANSLATIONS, customTranslations)
    assert.equal(translate('vi', 'test.key'), 'English original')
  } finally {
    // Restore
    Object.keys(TRANSLATIONS).forEach((k) => delete TRANSLATIONS[k])
    Object.assign(TRANSLATIONS, originalTranslations)
  }

  // Key missing in both returns the key itself
  assert.equal(translate('vi', 'nonexistent.random.key'), 'nonexistent.random.key')
})

test('i18n: all 7 languages provide all core UI keys', () => {
  const coreKeys = [
    'header.title',
    'header.subtitle',
    'header.mockBadge',
    'header.detailLevel',
    'header.simple',
    'header.expert',
    'header.language',
    'nav.map',
    'nav.results',
    'nav.detail',
    'nav.globe',
    'nav.learn',
    'nav.about',
    'picker.region',
    'picker.cell',
    'picker.choose',
    'picker.notFeasible',
    'scenario.title',
    'scenario.currentPoint',
    'scenario.startDate',
    'scenario.endDate',
    'scenario.stayDays',
    'scenario.lander',
    'scenario.findWindows',
    'scenario.searching',
    'results.title',
    'results.idlePrompt',
    'results.rankingDefaultOrder',
    'status.pass',
    'status.marginal',
    'status.fail',
    'columns.rank',
    'columns.cell',
    'columns.landing',
    'columns.minBattery',
    'columns.longestDark',
    'columns.status',
    'currentPoint.title',
    'detail.back',
    'detail.numbersTitle',
    'detail.downloadCsv',
    'learn.metricsTitle',
    'learn.neighborTitle',
    'learn.moonTitle',
    'about.whatTitle',
  ]

  for (const langCode of Object.keys(LANGUAGES)) {
    const dict = TRANSLATIONS[langCode]
    assert.ok(dict, `Translation dictionary for "${langCode}" must exist`)

    for (const key of coreKeys) {
      assert.ok(
        typeof dict[key] === 'string' && dict[key].length > 0,
        `Key "${key}" must be defined and non-empty for language "${langCode}"`,
      )
    }
  }
})

test('i18n: DEFAULT_CONTEXT_VALUE provides safe default English fallback', () => {
  assert.equal(DEFAULT_CONTEXT_VALUE.lang, 'en')
  assert.equal(typeof DEFAULT_CONTEXT_VALUE.setLang, 'function')
  assert.equal(typeof DEFAULT_CONTEXT_VALUE.t, 'function')
  assert.equal(DEFAULT_CONTEXT_VALUE.t('header.title'), 'Lunar Landing Site Navigator')
})
