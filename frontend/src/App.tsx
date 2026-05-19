import { Fragment, useMemo, useState, type ReactNode } from 'react'

import { Button } from './components/ui/button'
import { useTreasuryStream } from './hooks/useTreasuryStream'

type TelemetryLine = {
  id: string
  kind: 'thought' | 'vad' | 'json' | 'target'
  label: string
  content: string
  timestamp: string
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, maxLength - 3).trimEnd()}...`
}

type DeadlineSignal = {
  label: string
  toneClass: string
}

function getDeadlineSignal(closeDate: string): DeadlineSignal {
  const parsed = Date.parse(closeDate)
  if (Number.isNaN(parsed)) {
    return {
      label: 'Schedule unavailable',
      toneClass: 'border-border text-foreground/70 bg-card/60',
    }
  }

  const now = new Date()
  const closeAt = new Date(parsed)
  const msPerDay = 1000 * 60 * 60 * 24
  const daysRemaining = Math.ceil((closeAt.getTime() - now.getTime()) / msPerDay)

  if (daysRemaining < 0) {
    return {
      label: 'Closed',
      toneClass: 'border-danger/40 text-danger bg-danger/10',
    }
  }
  if (daysRemaining <= 14) {
    return {
      label: `Due in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
      toneClass: 'border-danger/40 text-danger bg-danger/10',
    }
  }
  if (daysRemaining <= 45) {
    return {
      label: `Due in ${daysRemaining} days`,
      toneClass: 'border-accent/40 text-accent bg-accent/10',
    }
  }
  return {
    label: `${daysRemaining} days remaining`,
    toneClass: 'border-success/40 text-success bg-success/10',
  }
}

function renderPitchLine(text: string): ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*)/g)
  return segments.map((segment, index) => {
    const isBold = segment.startsWith('**') && segment.endsWith('**') && segment.length > 4
    if (!isBold) {
      return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>
    }
    return (
      <strong key={`${segment}-${index}`} className="font-semibold text-foreground">
        {segment.slice(2, -2)}
      </strong>
    )
  })
}

function PitchText({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={`${paragraph}-${paragraphIndex}`} className="text-sm text-foreground/80 leading-relaxed font-sans">
          {paragraph.split('\n').map((line, lineIndex, lines) => (
            <Fragment key={`${line}-${lineIndex}`}>
              {renderPitchLine(line)}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  )
}

function App() {
  const stream = useTreasuryStream()
  const [businessContext, setBusinessContext] = useState('')
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)
  const [proposalRecipient, setProposalRecipient] = useState('grants@fervoai.tech')
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const trimmedContext = businessContext.trim()
  const canExecute = trimmedContext.length > 0

  const telemetryLines = useMemo(() => {
    const anchorTimestamp = stream.monologueLog[0]?.timestamp ?? new Date().toISOString()

    const thoughtLines: TelemetryLine[] = [...stream.monologueLog]
      .reverse()
      .map((entry, index) => ({
        id: `thought-${entry.timestamp}-${index}-${entry.text.slice(0, 16)}`,
        kind: 'thought',
        label: 'THOUGHT',
        content: entry.text,
        timestamp: entry.timestamp,
      }))

    const vadLines: TelemetryLine[] = stream.vad
      ? [
          {
            id: `vad-${stream.vad.valence.toFixed(3)}-${stream.vad.arousal.toFixed(3)}-${stream.vad.dominance.toFixed(3)}`,
            kind: 'vad',
            label: 'VAD',
            content: `V:${stream.vad.valence.toFixed(2)} A:${stream.vad.arousal.toFixed(2)} D:${stream.vad.dominance.toFixed(2)}`,
            timestamp: anchorTimestamp,
          },
        ]
      : []

    const payloadLines: TelemetryLine[] = []

    if (stream.grants[0]) {
      const target = stream.grants[0]
      payloadLines.push({
        id: `target-${stream.grants[0].opportunity_number}`,
        kind: 'target',
        label: 'TARGET_JSON',
        content: `Opportunity: ${target.opportunity_number}\nAgency: ${target.agency}\nClose: ${target.close_date}\nTitle: ${target.title}`,
        timestamp: anchorTimestamp,
      })
    }

    if (stream.pitch) {
      payloadLines.push({
        id: `pitch-${stream.pitch.model_used}-${stream.pitch.status}`,
        kind: 'json',
        label: 'PITCH_JSON',
        content: JSON.stringify(
          {
            model_used: stream.pitch.model_used,
            status: stream.pitch.status,
          },
          null,
          0,
        ),
        timestamp: anchorTimestamp,
      })
    }

    return [...thoughtLines, ...vadLines, ...payloadLines]
  }, [stream.monologueLog, stream.vad, stream.grants, stream.pitch])

  const activeTarget = stream.grants[0] ?? null
  const activeDeadlineSignal = activeTarget ? getDeadlineSignal(activeTarget.close_date) : null

  const buildProposalExport = useMemo(() => {
    if (!stream.pitch) {
      return null
    }

    const subjectBase = activeTarget?.title?.trim() || 'Treasury Agent Grant Proposal'
    const subject = `Treasury Agent Proposal | ${subjectBase}`

    const bodySections = [
      'Treasury Agent Proposal',
      '',
      activeTarget ? `Target Opportunity: ${activeTarget.title}` : null,
      activeTarget ? `Opportunity ID: ${activeTarget.opportunity_number}` : null,
      activeTarget ? `Agency: ${activeTarget.agency}` : null,
      activeTarget ? `Close Date: ${activeTarget.close_date}` : null,
      activeTarget?.url ? `Source: ${activeTarget.url}` : null,
      '',
      stream.pitch.pitch_draft,
    ].filter(Boolean)

    const body = bodySections.join('\n')
    return { subject, body }
  }, [stream.pitch, activeTarget])

  const handleCopyProposal = async () => {
    if (!buildProposalExport) {
      return
    }
    try {
      await navigator.clipboard.writeText(buildProposalExport.body)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
    setTimeout(() => setCopyStatus('idle'), 1800)
  }

  const proposalMailtoHref = buildProposalExport
    ? `mailto:${encodeURIComponent(proposalRecipient.trim())}?subject=${encodeURIComponent(buildProposalExport.subject)}&body=${encodeURIComponent(buildProposalExport.body)}`
    : '#'

  const handleCommandOverride = () => {
    setHasTriedSubmit(true)
    if (!canExecute) {
      return
    }
    stream.runQuery(trimmedContext)
  }

  return (
    <div className="bg-background text-foreground scanline-overlay min-h-screen">
      <header className="border-border flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div>
          <div className="font-heading text-4xl uppercase tracking-[0.08em] leading-none sm:text-5xl">
            Treasury <span className="flame-gradient-text">Agent</span>
          </div>
          <p className="mt-1 font-body text-[11px] uppercase tracking-[0.12em] text-foreground/55">
            A FERVOAI product
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end sm:gap-6">
          <div className="font-mono text-foreground/70 text-[10px] uppercase tracking-[0.12em] sm:text-xs">NODE: FERVOAI.TECH</div>
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-success flex items-center gap-2 sm:text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-success animate-pulse" />
            Link Established
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6 xl:grid-cols-3">
        <section className="order-2 md:order-1 bg-card border-border xl:col-span-2 rounded border">
          <div className="bg-card border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-heading text-2xl uppercase tracking-[0.08em]">Live Execution Narrative</h2>
            <span className="font-mono text-foreground/60 text-xs uppercase tracking-[0.12em]">{stream.status}</span>
          </div>

          <div className="log-scroll h-[46vh] sm:h-[70vh] overflow-y-auto p-4 font-mono text-sm">
            {telemetryLines.length === 0 && <p className="text-foreground/55">Awaiting live execution signal...</p>}

            {telemetryLines.map((line) => {
              const labelClass =
                line.kind === 'thought'
                  ? 'text-foreground/85'
                  : line.kind === 'vad'
                    ? 'text-foreground/55'
                    : line.kind === 'target'
                      ? 'text-foreground/90'
                      : 'text-foreground/50'
              const bodyClass =
                line.kind === 'thought'
                  ? 'text-foreground/72'
                  : line.kind === 'vad'
                    ? 'text-foreground/55'
                    : line.kind === 'target'
                      ? 'text-foreground/72'
                      : 'text-foreground/50'
              const rowClass = line.kind === 'target' ? 'flame-left-border pl-3' : ''

              return (
                <div key={line.id} className={`border-border/50 mb-3 border-b pb-3 last:border-b-0 ${rowClass}`}>
                  <div className={`text-[11px] tracking-[0.11em] uppercase ${labelClass}`}>
                    [{new Date(line.timestamp).toLocaleTimeString()}] {line.label}
                  </div>
                  <pre className={`mt-1 whitespace-pre-wrap break-words leading-relaxed ${bodyClass}`}>{line.content}</pre>
                </div>
              )
            })}

            <div className="text-foreground mt-2 text-sm">
              <span className="text-foreground/70">_</span>
              <span className="cursor-blink ml-1 text-accent">_</span>
            </div>
          </div>
        </section>

        <aside className="order-1 md:order-2 bg-card border-border rounded border">
          <div className="bg-card border-border border-b px-4 py-3">
            <h2 className="font-heading text-2xl uppercase tracking-[0.08em]">Treasury Agent Console</h2>
          </div>

          <div className="space-y-5 p-4">
            <div>
              <label htmlFor="business-context" className="font-heading text-foreground/60 mb-2 block text-sm uppercase tracking-[0.12em]">
                Strategic Context
              </label>
              <textarea
                id="business-context"
                value={businessContext}
                onChange={(event) => {
                  setBusinessContext(event.target.value)
                  if (hasTriedSubmit && event.target.value.trim()) {
                    setHasTriedSubmit(false)
                  }
                }}
                placeholder="B2B AI infrastructure for autonomous cloud optimization..."
                rows={5}
                className="bg-background border-border font-mono text-foreground placeholder:text-foreground/35 focus:border-accent focus:ring-danger/30 w-full resize-none rounded border px-3 py-2 text-sm outline-none transition focus:ring-2"
              />
              {hasTriedSubmit && !canExecute && (
                <p className="font-mono text-danger mt-2 text-xs">Context required to execute workflow.</p>
              )}
            </div>

            <Button
              type="button"
              onClick={handleCommandOverride}
              disabled={!canExecute}
              className="flame-gradient font-heading text-background hover:text-background disabled:text-background/50 disabled:cursor-not-allowed disabled:opacity-55 w-full rounded px-4 py-3 text-2xl uppercase tracking-[0.1em] shadow-[0_0_24px_hsl(var(--accent)/0.25)] border-transparent"
            >
              Run Treasury Agent
            </Button>

            <div className="bg-card/80 border border-success/30 rounded-lg p-4 shadow-[0_0_15px_hsl(var(--success)/0.12)]">
              <div>
                <div className="text-success text-xs font-mono font-bold tracking-widest mb-2 border-b border-success/30 pb-1">
                  TARGET ACQUIRED
                </div>
                {activeTarget ? (
                  <div className="mt-4 translate-y-0 space-y-4 opacity-100 transition-all duration-500 ease-out">
                    <h3 className="text-lg font-bold text-foreground mb-1">{activeTarget.title}</h3>
                    <p className="text-xs uppercase tracking-[0.11em] text-foreground/55 font-mono">
                      {activeTarget.agency} | {activeTarget.category}
                    </p>
                    <div className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.1em] ${activeDeadlineSignal?.toneClass}`}>
                      {activeDeadlineSignal?.label}
                    </div>

                    <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.12em] text-foreground/65 font-mono">Estimated Award Range</p>
                      <p className="mt-1 text-base font-semibold text-foreground">
                        {activeTarget.award_floor || 'Not specified'} - {activeTarget.award_ceiling || 'Not specified'}
                      </p>
                    </div>

                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.12em]">
                        <span className="text-foreground/60">Match Confidence</span>
                        <span className="text-success font-semibold">94%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-card/90 border border-success/20">
                        <div className="h-full w-[94%] bg-gradient-to-r from-success/75 to-success" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs text-foreground/70 font-mono mt-3">
                      <div>
                        <p className="uppercase tracking-[0.12em] text-muted">Opportunity ID</p>
                        <p className="mt-1 text-foreground/85">{activeTarget.opportunity_number}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.12em] text-muted">Posted</p>
                        <p className="mt-1 text-foreground/85">{activeTarget.post_date || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.12em] text-muted">Closes</p>
                        <p className="mt-1 text-foreground/85">{activeTarget.close_date}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.12em] text-muted">Category</p>
                        <p className="mt-1 text-foreground/85">{activeTarget.category}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.12em] text-muted">Award Floor</p>
                        <p className="mt-1 text-foreground/85">{activeTarget.award_floor || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-[0.12em] text-muted">Award Ceiling</p>
                        <p className="mt-1 text-foreground/85">{activeTarget.award_ceiling || 'Not specified'}</p>
                      </div>
                    </div>

                    <div className="border border-border/60 rounded-md bg-card/65 px-3 py-2">
                      <p className="uppercase tracking-[0.12em] text-muted text-[11px] font-mono">Grant Brief</p>
                      <p className="mt-1 text-sm text-foreground/80 leading-relaxed">
                        {truncateText(activeTarget.description?.trim() || 'No description provided for this opportunity yet.', 320)}
                      </p>
                    </div>

                    {activeTarget.url ? (
                      <a
                        href={activeTarget.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded border border-accent/40 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.11em] text-foreground/85 transition hover:border-accent hover:text-foreground"
                      >
                        View Full Grant
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 translate-y-4 opacity-70 transition-all duration-500 ease-out">
                    <p className="text-sm text-muted">No opportunity selected yet.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 p-4 bg-card/70 border-l-2 border-info rounded-r-lg">
              <h3 className="font-heading mb-2 text-xl uppercase tracking-[0.08em]">Treasury Agent Proposal</h3>
              {stream.pitch ? (
                <div className="translate-y-0 opacity-100 transition-all duration-500 ease-out">
                  <p className="font-mono text-foreground/60 mb-2 text-xs uppercase">
                    {stream.pitch.model_used} | {stream.pitch.status}
                  </p>
                  <div className="mb-3 grid grid-cols-1 gap-2">
                    <label htmlFor="proposal-recipient" className="text-[11px] font-mono uppercase tracking-[0.1em] text-foreground/60">
                      Receiver Email
                    </label>
                    <input
                      id="proposal-recipient"
                      type="email"
                      value={proposalRecipient}
                      onChange={(event) => setProposalRecipient(event.target.value)}
                      placeholder="name@agency.gov"
                      className="bg-background border-border font-mono text-foreground placeholder:text-foreground/35 focus:border-accent focus:ring-danger/30 w-full rounded border px-3 py-2 text-xs outline-none transition focus:ring-2"
                    />
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleCopyProposal}
                      className="rounded border border-border px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.11em] text-foreground/85 transition hover:border-accent hover:text-foreground"
                    >
                      {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy Failed' : 'Copy Proposal'}
                    </button>
                    <a
                      href={proposalMailtoHref}
                      className="rounded border border-info/40 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.11em] text-foreground/85 transition hover:border-info hover:text-foreground"
                    >
                      Send by Email
                    </a>
                  </div>
                  <PitchText text={stream.pitch.pitch_draft} />
                </div>
              ) : (
                <div className="translate-y-4 opacity-70 transition-all duration-500 ease-out">
                  <p className="font-body text-foreground/60 text-sm">No proposal generated yet.</p>
                </div>
              )}
              {stream.error && <p className="font-mono text-danger mt-3 text-xs">{stream.error}</p>}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App

