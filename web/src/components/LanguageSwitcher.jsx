import { LANGUAGES, useI18n } from '../i18n/index.jsx'

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()

  const primary = Object.values(LANGUAGES).filter((l) => l.group === 'primary')
  const secondary = Object.values(LANGUAGES).filter((l) => l.group === 'secondary')

  return (
    <div className="relative inline-flex items-center">
      <label htmlFor="language-switcher-select" className="sr-only">
        {t('header.language')}
      </label>
      <select
        id="language-switcher-select"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label={t('header.language')}
        className="rounded border border-slate-500 bg-slate-950 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-400 hover:text-white focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
      >
        <optgroup label={lang === 'vi' ? 'Chính' : 'Primary'}>
          {primary.map((l) => (
            <option key={l.code} value={l.code} className="bg-slate-900 text-slate-100">
              {l.name}
            </option>
          ))}
        </optgroup>
        <optgroup label={lang === 'vi' ? 'Khác' : 'Secondary'}>
          {secondary.map((l) => (
            <option key={l.code} value={l.code} className="bg-slate-900 text-slate-100">
              {l.name}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}

