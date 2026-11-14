import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LANGUAGES, TRANSLATIONS } from './translations.js'

export { LANGUAGES, TRANSLATIONS }

export const STORAGE_KEY = 'lunar_lang'
export const DEFAULT_LANG = 'en'

/**
 * Parameter interpolation for translated strings:
 * e.g. interpolate("Hello {name}!", { name: "Artemis" }) -> "Hello Artemis!"
 * Supports both {key} and {{key}} forms.
 */
export function interpolate(text, params) {
  if (!params || typeof text !== 'string') return text
  return text.replace(/\{\{?([^{}]+)\}?\}/g, (match, paramName) => {
    const trimmed = paramName.trim()
    return trimmed in params ? String(params[trimmed]) : match
  })
}

/**
 * Resolves a translation key with fallback:
 * 1. Look up key in the requested language dictionary.
 * 2. If missing, look up key in the English ('en') dictionary.
 * 3. If still missing, return the key itself.
 */
export function translate(lang, key, params) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANG]
  let text = dict?.[key]
  if (text === undefined && lang !== DEFAULT_LANG) {
    text = TRANSLATIONS[DEFAULT_LANG]?.[key]
  }
  if (text === undefined) {
    text = key
  }
  return interpolate(text, params)
}

export const DEFAULT_CONTEXT_VALUE = Object.freeze({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (key, params) => translate(DEFAULT_LANG, key, params),
})

const I18nContext = createContext(DEFAULT_CONTEXT_VALUE)

function getInitialLanguage() {
  if (typeof window === 'undefined') return DEFAULT_LANG
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved && saved in LANGUAGES) {
      return saved
    }
  } catch {
    // Ignore localStorage access errors (e.g. sandbox, private browsing)
  }
  return DEFAULT_LANG
}

export function I18nProvider({ children, initialLang }) {
  const [lang, setLangState] = useState(() => initialLang ?? getInitialLanguage())

  const setLang = useCallback((nextLang) => {
    if (!nextLang || !(nextLang in LANGUAGES)) return
    setLangState(nextLang)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, nextLang)
      }
    } catch {
      // Ignore localStorage errors
    }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = nextLang
    }
  }, [])

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang
    }
  }, [lang])

  const t = useCallback((key, params) => translate(lang, key, params), [lang])

  const contextValue = useMemo(() => ({
    lang,
    setLang,
    t,
  }), [lang, setLang, t])

  return createElement(I18nContext.Provider, { value: contextValue }, children)
}

/**
 * Access the translation hook from any component.
 * Safely defaults to English if called outside an I18nProvider (e.g. standalone unit tests).
 */
export function useI18n() {
  const ctx = useContext(I18nContext)
  return ctx || DEFAULT_CONTEXT_VALUE
}
