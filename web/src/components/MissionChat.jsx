import { useEffect, useRef, useState } from 'react'
import { describeChatScenario } from '../core/missionChat.js'
import { validateScenario } from '../core/scenario.js'
import { missionFieldStatus, recordEnteredFields } from '../core/missionGuide.js'
import MissionGuide, { ParameterStatus } from './MissionGuide.jsx'
import { useI18n } from '../i18n/index.jsx'

const buttonClass = 'rounded border border-slate-500 px-3 py-2 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40'
const EXAMPLE = 'At Malapert Massif, January 1–7, 2028, stay 6 days. Battery 10 kWh, panel 1 kW, load 300 W.'

function boundedHistory(messages) {
  let length = 0
  return messages.slice(-6).reverse().filter(({ content }) => {
    length += content.length
    return length <= 6000
  }).reverse()
}

export default function MissionChat({ value, sites, ephemeris, busy, useMock, enteredFields = {}, onApply }) {
  const { t } = useI18n()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [proposal, setProposal] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const entered = enteredFields
  const activeRequest = useRef(null)
  const transcript = useRef(null)
  const snapshot = JSON.stringify(value)
  const stale = proposal && proposal.baseSnapshot !== snapshot
  const draft = proposal?.draft
  const canApply = draft?.canApply && !proposal.superseded && !stale && !pending && !busy && validateScenario(draft.scenario, ephemeris).length === 0
  const shownScenario = draft?.scenario ?? value
  const shownErrors = draft?.errors ?? validateScenario(value, ephemeris)
  const shownEntered = proposal?.entered ?? entered

  useEffect(() => () => activeRequest.current?.abort(), [])
  useEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight
  }, [messages, pending])

  async function send(event) {
    event.preventDefault()
    if (activeRequest.current || !input.trim() || busy || useMock) return
    const message = input.trim()
    const baseSnapshot = snapshot
    const scenario = proposal && !stale ? proposal.draft.scenario : value
    const previousEntered = proposal && !stale ? proposal.entered : entered
    const controller = new AbortController()
    activeRequest.current = controller
    const timeout = setTimeout(() => controller.abort(), 22000)
    // Keep the draft as follow-up context, but only a successful reply may enable Apply again.
    setProposal((current) => current && { ...current, superseded: true })
    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/mission-chat', {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', signal: controller.signal,
        body: JSON.stringify({ requestId: crypto.randomUUID(), message, history: boundedHistory(messages), scenario }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The assistant is unavailable. Use the mission form below.')
      if (!result.scenario || !Array.isArray(result.questions) || !Array.isArray(result.errors) || typeof result.message !== 'string') throw new Error('The assistant returned an incomplete draft. Use the mission form below.')
      setMessages((current) => [...current, { role: 'user', content: message }, {
        role: 'assistant', content: [result.message, ...result.questions].join('\n').slice(0, 1200),
      }].slice(-16))
      setProposal({ draft: result, baseSnapshot, entered: recordEnteredFields(previousEntered, result.patch ?? {}) })
      setInput('')
    } catch (failure) {
      setError(failure.name === 'AbortError' ? 'The assistant took too long. Your form is unchanged; you can keep using it below.' : failure instanceof SyntaxError ? 'The assistant is unavailable. Use the mission form below.' : failure.message)
    } finally {
      clearTimeout(timeout)
      activeRequest.current = null
      setPending(false)
    }
  }

  return (
    <section id="mission-assistant" aria-labelledby="mission-chat-title" className="scroll-mt-4 space-y-4 rounded-xl border-2 border-sky-500 bg-gradient-to-b from-sky-950 to-slate-900 p-4 shadow-lg shadow-sky-950/50">
      <div className="flex items-center justify-between gap-2">
        <h2 id="mission-chat-title" className="text-lg font-semibold text-sky-100">Describe your mission</h2>
        <span className="rounded bg-sky-950 px-2 py-0.5 text-xs text-sky-200">AI assist</span>
      </div>
      <p className="text-sm text-slate-200">{t('chat.intro')}</p>
      <ol aria-label="How the mission assistant works" className="flex flex-wrap gap-2 text-xs text-sky-100">
        <li className="rounded-full bg-sky-900 px-2 py-1">{t('chat.describe')}</li><li className="rounded-full bg-sky-900 px-2 py-1">{t('chat.review')}</li><li className="rounded-full bg-sky-900 px-2 py-1">{t('chat.apply')}</li>
      </ol>
      {useMock ? <p className="text-sm text-amber-300">The assistant is available with the real site catalog. Use the form with mock data.</p> : <>
        <MissionGuide scenario={stale ? value : shownScenario} sites={sites} ephemeris={ephemeris} entered={stale ? entered : shownEntered} disabled={pending || busy} onUse={(message) => {
          setInput(message)
          document.getElementById('mission-message')?.focus()
        }} />
        {messages.length > 0 && <div ref={transcript} role="log" aria-label="Mission conversation" aria-live="polite" className="max-h-64 space-y-3 overflow-y-auto text-sm">
          {messages.map(({ role, content }, index) => <div key={index} className={role === 'user' ? 'rounded bg-slate-800 p-2' : 'p-2 text-sky-100'}>
            <span className="mb-1 block text-xs font-semibold text-slate-400">{role === 'user' ? 'You' : 'Assistant'}</span>
            <p className="whitespace-pre-wrap break-words">{content}</p>
          </div>)}
        </div>}
        <form onSubmit={send} className="space-y-2" aria-busy={pending}>
          <label htmlFor="mission-message" className="block text-sm text-slate-300">Your mission or a clarification</label>
          <textarea id="mission-message" value={input} onChange={(event) => setInput(event.target.value)} maxLength={1200} rows={3}
            placeholder="e.g. I want to explore Malapert for a few days. What details do you need?" disabled={pending || busy}
            className="w-full resize-y rounded border border-slate-500 bg-slate-950 p-2 text-sm" aria-describedby="mission-chat-privacy" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={pending || busy || !input.trim()} className={`${buttonClass} bg-sky-900`}>{pending ? 'Preparing draft…' : 'Send message'}</button>
            <button type="button" disabled={pending || busy} onClick={() => setInput(EXAMPLE)} className={buttonClass}>Try an example</button>
            {messages.length > 0 && <button type="button" disabled={pending} className={buttonClass} onClick={() => {
              setMessages([]); setProposal(null); setError(''); setNotice(''); setInput('')
            }}>Clear chat</button>}
          </div>
        </form>
        <p id="mission-chat-privacy" className="text-xs text-slate-400">Sending shares your message, recent chat and mission settings with Google Gemini. Avoid private information. Free-tier data may be used to improve Google products.</p>
        {pending && <p role="status" className="text-sm text-sky-200">Preparing parameters for review…</p>}
        {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
        {notice && <p role="status" className="text-sm text-sky-200">{notice}</p>}
        {!draft && <div className="space-y-2 border-t border-sky-900 pt-3">
          <h3 className="text-sm font-medium">{t('chat.starting')}</h3>
          <ParameterReview scenario={value} sites={sites} entered={entered} errors={shownErrors} />
        </div>}
        {draft && <div className="space-y-2 border-t border-slate-700 pt-3">
          <h3 className="text-sm font-medium">Review mission draft</h3>
          <ParameterReview scenario={draft.scenario} sites={sites} entered={shownEntered} errors={draft.errors} />
          <p className="text-xs text-slate-400">Unspecified settings keep your current form values. Example values are illustrative; check every limit. The assistant does not calculate landing results.</p>
          {draft.errors.length > 0 && <ul className="list-inside list-disc text-xs text-amber-300">{draft.errors.map(({ field, message }) => <li key={field}>{message}</li>)}</ul>}
          {draft.questions.length > 0 && <p className="text-xs text-amber-300">Answer the assistant's questions above before applying.</p>}
          {!pending && proposal.superseded && <p role="status" className="text-sm text-amber-300">This draft predates your latest message. Send again to update it before applying.</p>}
          {!proposal.superseded && !draft.canApply && draft.errors.length === 0 && draft.questions.length === 0 && <p className="text-xs text-slate-400">No mission parameters were proposed. Describe a mission or a setting to change.</p>}
          {stale && <p role="status" className="text-sm text-amber-300">Your form changed. Send another message to prepare a draft using the latest values.</p>}
          <button type="button" disabled={!canApply} className={`${buttonClass} w-full bg-sky-900`} onClick={() => {
            if (!canApply) return
            onApply(draft.scenario, shownEntered)
            setProposal(null)
            setNotice('Applied. Review the form below, then choose Find landing windows.')
          }}>Apply draft to form</button>
        </div>}
      </>}
    </section>
  )
}

function ParameterReview({ scenario, sites, entered, errors }) {
  const { t } = useI18n()
  return <div>
    <dl className="space-y-2 text-xs">
      {describeChatScenario(scenario, sites).map(([, text, field]) => {
        const status = missionFieldStatus(field, scenario, entered, errors)
        return <div key={field} data-review-field={field} className={`rounded border bg-slate-950/50 p-2 ${status.kind === 'invalid' ? 'border-red-700' : 'border-slate-700'}`}>
          <div className="flex flex-wrap items-center justify-between gap-1"><dt className="text-slate-300">{t(`chat.field.${field}`)}</dt><ParameterStatus status={status} /></div>
          <dd className={`mt-1 break-words font-medium ${status.kind === 'default' ? 'text-slate-400' : status.kind === 'entered' ? 'text-emerald-200' : status.kind === 'invalid' ? 'text-red-200' : ''}`}>{text}</dd>
        </div>
      })}
    </dl>
    <p className="mt-2 text-xs text-slate-400">{t('chat.legend')}</p>
  </div>
}
