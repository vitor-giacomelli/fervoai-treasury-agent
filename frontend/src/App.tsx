import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'

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

function firstSentence(text: string): string {
  const normalized = text.trim()
  if (!normalized) {
    return ''
  }
  const parts = normalized.split(/[.!?]\s/)
  return parts[0] || normalized
}

function swarmStatusTone(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'dispatched' || normalized === 'completed') {
    return 'bg-success'
  }
  if (normalized === 'in_progress' || normalized === 'queued') {
    return 'bg-accent'
  }
  return 'bg-foreground/45'
}

function decodeHtmlEntities(text: string): string {
  if (typeof document === 'undefined') {
    return text
  }
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
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
  const [recipientOverrides, setRecipientOverrides] = useState<Record<string, string>>({})
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [expandedNarrativeTargetId, setExpandedNarrativeTargetId] = useState<string | null>(null)
  const [swarmDispatched, setSwarmDispatched] = useState(false)

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
  const activeOpportunityKey = activeTarget?.opportunity_number ?? ''
  const defaultRecipient = activeTarget?.recipient_email?.trim() || ''
  const proposalRecipient = activeOpportunityKey
    ? (recipientOverrides[activeOpportunityKey] ?? defaultRecipient)
    : defaultRecipient

  const buildProposalExport = useMemo(() => {
    if (!stream.pitch) {
      return null
    }

    const cleanTitle = decodeHtmlEntities(activeTarget?.title?.trim() || 'Treasury Agent Grant Proposal')
    const subjectBase = cleanTitle
    const subject = `Treasury Agent Proposal | ${subjectBase}`

    const proposalOwner = 'Treasury Agent (fervoAI ecosystem)'
    const generatedAt = new Date().toLocaleString()
    const awardRange = `${activeTarget?.award_floor || 'Not specified'} - ${activeTarget?.award_ceiling || 'Not specified'}`

    const bodySections = [
      'TREASURY AGENT | EXECUTIVE PROPOSAL BRIEF',
      '',
      `Prepared by: ${proposalOwner}`,
      `Generated at: ${generatedAt}`,
      '',
      'Opportunity Snapshot',
      `- Title: ${cleanTitle || 'Not specified'}`,
      `- Agency: ${activeTarget?.agency || 'Not specified'}`,
      `- Opportunity ID: ${activeTarget?.opportunity_number || 'Not specified'}`,
      `- Posted: ${activeTarget?.post_date || 'Not specified'}`,
      `- Closes: ${activeTarget?.close_date || 'Not specified'}`,
      `- Award Range: ${awardRange}`,
      `- Category: ${activeTarget?.category || 'Not specified'}`,
      `- Source: ${activeTarget?.url || 'Not specified'}`,
      '',
      'Treasury Agent Proposal Narrative',
      stream.pitch.pitch_draft.trim(),
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

  const mailtoRecipient = proposalRecipient.trim()
  const proposalMailtoHref = buildProposalExport
    ? `mailto:${mailtoRecipient}?subject=${encodeURIComponent(buildProposalExport.subject)}&body=${encodeURIComponent(buildProposalExport.body)}`
    : '#'
  const isHuntMode = stream.status === 'connecting' || stream.status === 'connected'
  const isLockMode = stream.status === 'completed'

  const quickPresets = [
    'Grid Modernization',
    'AI Infrastructure',
    'Climate Resilience',
  ]

  const stageStates = useMemo(() => {
    const stageChecks = {
      init: stream.monologueLog.some((entry) => entry.text.toLowerCase().includes('workflow booted')),
      fetch: stream.monologueLog.some((entry) => entry.text.toLowerCase().includes('fetching grant opportunities')),
      filter: stream.monologueLog.some((entry) => entry.text.toLowerCase().includes('evaluating relevance with gemini')),
      select:
        stream.grants.length > 0 ||
        stream.monologueLog.some((entry) => entry.text.toLowerCase().includes('selected ')),
      pitch: Boolean(stream.pitch),
    }

    const ordered = [
      { key: 'init', label: 'Init', complete: stageChecks.init },
      { key: 'fetch', label: 'Fetch', complete: stageChecks.fetch },
      { key: 'filter', label: 'Filter', complete: stageChecks.filter },
      { key: 'select', label: 'Select', complete: stageChecks.select },
      { key: 'pitch', label: 'Pitch', complete: stageChecks.pitch },
    ]

    const currentIndex = ordered.findIndex((stage) => !stage.complete)
    return ordered.map((stage, index) => ({
      ...stage,
      active:
        stream.status !== 'idle' &&
        (index === currentIndex || (currentIndex === -1 && index === ordered.length - 1)),
    }))
  }, [stream.monologueLog, stream.grants.length, stream.pitch, stream.status])

  const handleCommandOverride = () => {
    setHasTriedSubmit(true)
    if (!canExecute) {
      return
    }
    stream.runQuery(trimmedContext)
  }

  const handlePresetRun = (preset: string) => {
    setBusinessContext(preset)
    setHasTriedSubmit(false)
    stream.runQuery(preset)
  }

  useEffect(() => {
    if (stream.status !== 'completed') {
      setSwarmDispatched(false)
    }
  }, [stream.status, stream.pitch])

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
        <section className={`order-1 xl:col-span-3 rounded border px-4 py-3 transition-all duration-500 ${
          isHuntMode
            ? 'border-accent/50 bg-accent/10 shadow-[0_0_24px_hsl(var(--accent)/0.25)]'
            : isLockMode
              ? 'border-success/40 bg-success/10 shadow-[0_0_20px_hsl(var(--success)/0.2)]'
              : 'border-border bg-card/70'
        }`}>
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-foreground/70">
            {isHuntMode
              ? 'STATEFUL ORCHESTRATION ONLINE | HUNTING LIVE FEDERAL DATA'
              : isLockMode
                ? 'STATEFUL ORCHESTRATION CONFIRMED | TARGET LOCKED | EXECUTION PACKAGE READY'
                : 'STATEFUL ORCHESTRATION STANDBY | AWAITING STRATEGIC INPUT'}
          </p>
        </section>

        <section className="order-1 xl:col-span-3 rounded border border-border bg-card/80 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {stageStates.map((stage) => (
              <div
                key={stage.key}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-[0.1em] transition ${
                  stage.complete
                    ? 'border-success/40 bg-success/10 text-success'
                    : stage.active
                      ? 'border-accent/40 bg-accent/10 text-accent animate-pulse'
                      : 'border-border text-foreground/55'
                }`}
              >
                {stage.label}
              </div>
            ))}
          </div>
        </section>

        <section className={`order-2 md:order-1 xl:col-span-2 rounded border transition-all duration-500 ${
          isHuntMode
            ? 'bg-card border-accent/45 shadow-[0_0_24px_hsl(var(--accent)/0.2)]'
            : 'bg-card border-border'
        }`}>
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
              const isTargetExpanded = line.kind === 'target' && expandedNarrativeTargetId === line.id
              const isCriticalThought =
                line.kind === 'thought' &&
                /(workflow booted|fetching grant opportunities|acquired \d+ candidate grants|selected )/i.test(line.content)

              return (
                <div
                  key={line.id}
                  className={`border-border/50 mb-3 border-b pb-3 last:border-b-0 ${rowClass} ${
                    isHuntMode && isCriticalThought ? 'rounded border border-accent/30 bg-accent/5 px-2' : ''
                  }`}
                >
                  {line.kind === 'target' ? (
                    <button
                      type="button"
                      onClick={() => setExpandedNarrativeTargetId((prev) => (prev === line.id ? null : line.id))}
                      className="w-full text-left"
                    >
                      <div className={`text-[11px] tracking-[0.11em] uppercase ${labelClass}`}>
                        [{new Date(line.timestamp).toLocaleTimeString()}] {line.label} {isTargetExpanded ? '[-]' : '[+]'}
                      </div>
                      <pre className={`mt-1 whitespace-pre-wrap break-words leading-relaxed ${bodyClass}`}>
                        {line.content.split('\n')[0]}
                      </pre>
                    </button>
                  ) : (
                    <>
                      <div className={`text-[11px] tracking-[0.11em] uppercase ${labelClass}`}>
                        [{new Date(line.timestamp).toLocaleTimeString()}] {line.label}
                      </div>
                      <pre className={`mt-1 whitespace-pre-wrap break-words leading-relaxed ${bodyClass}`}>{line.content}</pre>
                    </>
                  )}

                  {isTargetExpanded && activeTarget ? (
                    <div className="mt-3 rounded-md border border-accent/35 bg-card/80 p-3">
                      <p className="text-[11px] font-mono uppercase tracking-[0.11em] text-foreground/60">
                        Opportunity Summary
                      </p>
                      <h4 className="mt-1 text-sm font-semibold text-foreground">{decodeHtmlEntities(activeTarget.title)}</h4>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-foreground/70 font-mono">
                        <p>Agency: {activeTarget.agency}</p>
                        <p>ID: {activeTarget.opportunity_number}</p>
                        <p>Close: {activeTarget.close_date}</p>
                        <p>Award: {activeTarget.award_floor || 'N/A'} - {activeTarget.award_ceiling || 'N/A'}</p>
                      </div>
                      <p className="mt-2 text-xs text-foreground/75 leading-relaxed">
                        {truncateText(decodeHtmlEntities(activeTarget.description?.trim() || 'No description available.'), 240)}
                      </p>
                    </div>
                  ) : null}
                </div>
              )
            })}

            <div className="text-foreground mt-2 text-sm">
              <span className="text-foreground/70">_</span>
              <span className="cursor-blink ml-1 text-accent">_</span>
            </div>
          </div>
        </section>

        <aside
          className={`order-1 md:order-2 rounded border transition-all duration-500 ${
            isHuntMode
              ? 'bg-card/80 border-border opacity-75'
              : isLockMode
                ? 'bg-card border-success/35 shadow-[0_0_20px_hsl(var(--success)/0.18)] opacity-100'
                : 'bg-card border-border'
          }`}
        >
          <div className="bg-card border-border border-b px-4 py-3">
            <h2 className="font-heading text-2xl uppercase tracking-[0.08em]">Treasury Agent Console</h2>
          </div>

          <div className="space-y-5 p-4">
            {activeTarget ? (
              <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2">
                <p className="text-[11px] font-mono uppercase tracking-[0.11em] text-foreground/65">
                  Stateful Confidence 94% | {activeDeadlineSignal?.label || 'Schedule unavailable'} | {activeTarget.agency}
                </p>
              </div>
            ) : null}

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
              <div className="mt-3 flex flex-wrap gap-2">
                {quickPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetRun(preset)}
                    className="rounded border border-border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.1em] text-foreground/80 transition hover:border-accent hover:text-foreground"
                  >
                    {preset}
                  </button>
                ))}
              </div>
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
              <div className="text-success text-xs font-mono font-bold tracking-widest mb-2 border-b border-success/30 pb-1">
                TARGET ACQUIRED
              </div>
              {activeTarget && isLockMode ? (
                <div className="translate-y-0 opacity-100 transition-all duration-500 ease-out">
                  <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr] gap-2 items-center">
                    <h3 className="text-base font-bold text-foreground truncate">{activeTarget.title}</h3>
                    <p className="text-xs font-mono text-foreground/70 truncate">ID: {activeTarget.opportunity_number}</p>
                    <p className="text-xs font-mono text-foreground/70 truncate">Close: {activeTarget.close_date}</p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 translate-y-4 opacity-70 transition-all duration-500 ease-out">
                  <p className="text-sm text-muted">
                    {isHuntMode ? 'Telemetry hunt in progress. Target card will lock on completion.' : 'No opportunity selected yet.'}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <div className="md:col-span-2 rounded-r-lg border-l-2 border-info bg-card/70 p-4">
                <h3 className="font-heading mb-2 text-xl uppercase tracking-[0.08em]">Treasury Agent Proposal Package</h3>
                {stream.pitch && isLockMode ? (
                  <div className="translate-y-0 opacity-100 transition-all duration-500 ease-out">
                    <p className="font-mono text-foreground/60 mb-2 text-xs uppercase">
                      {stream.pitch.model_used} | {stream.pitch.status}
                    </p>
                    <div className="max-h-[400px] overflow-y-auto pr-1">
                      <PitchText text={stream.pitch.pitch_draft} />
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2">
                      <label htmlFor="proposal-recipient" className="text-[11px] font-mono uppercase tracking-[0.1em] text-foreground/60">
                        Recipient Email
                      </label>
                      <input
                        id="proposal-recipient"
                        type="email"
                        value={proposalRecipient}
                        onChange={(event) => {
                          if (!activeOpportunityKey) {
                            return
                          }
                          setRecipientOverrides((prev) => ({
                            ...prev,
                            [activeOpportunityKey]: event.target.value,
                          }))
                        }}
                        placeholder="recipient@agency.gov"
                        className="bg-background border-border font-mono text-foreground placeholder:text-foreground/35 focus:border-accent focus:ring-danger/30 w-full rounded border px-3 py-2 text-xs outline-none transition focus:ring-2"
                      />
                      {!proposalRecipient.trim() && (
                        <p className="text-[11px] text-foreground/55 font-mono">
                          No contact email available in this listing. You can fill one manually.
                        </p>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCopyProposal}
                        className="rounded border border-border px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.11em] text-foreground/85 transition hover:border-accent hover:text-foreground"
                      >
                        {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy Failed' : 'Copy Proposal'}
                      </button>
                      <a
                        href={proposalMailtoHref}
                        onClick={(event) => {
                          if (!mailtoRecipient || !buildProposalExport) {
                            event.preventDefault()
                          }
                        }}
                        aria-disabled={!mailtoRecipient || !buildProposalExport}
                        className={`rounded border px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.11em] transition ${
                          mailtoRecipient && buildProposalExport
                            ? 'border-info/40 text-foreground/85 hover:border-info hover:text-foreground'
                            : 'border-border text-foreground/40 cursor-not-allowed'
                        }`}
                      >
                        Send by Email
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="translate-y-4 opacity-70 transition-all duration-500 ease-out">
                    <p className="font-body text-foreground/60 text-sm">
                      {isHuntMode ? 'Compiling proposal package from live hunt...' : 'No proposal generated yet.'}
                    </p>
                  </div>
                )}
              </div>

              <div className="md:col-span-1 space-y-4">
                {stream.pitch && isLockMode ? (
                  <>
                    <div className="rounded-md border border-info/35 bg-info/10 p-3">
                      <h4 className="text-[11px] font-mono uppercase tracking-[0.12em] text-foreground/75">
                        FEASIBILITY MATRIX
                      </h4>
                      <div className="mt-3 space-y-2">
                        {[
                          { label: 'Technical Fit', value: stream.pitch.feasibility_score.technical_fit },
                          { label: 'Compliance', value: stream.pitch.feasibility_score.compliance_readiness },
                          { label: 'Capital Efficiency', value: stream.pitch.feasibility_score.capital_efficiency },
                          { label: 'Execution', value: stream.pitch.feasibility_score.execution_confidence },
                        ].map((metric) => (
                          <div key={metric.label}>
                            <div className="mb-1 flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.1em]">
                              <span className="text-foreground/65">{metric.label}</span>
                              <span className="text-foreground/85">{metric.value}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded bg-card/85 border border-success/20">
                              <div
                                className="h-full bg-gradient-to-r from-success/70 to-success"
                                style={{ width: `${Math.max(0, Math.min(100, metric.value))}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded border border-success/30 bg-success/10 px-3 py-2 text-center">
                        <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/65">Composite</p>
                        <p className="text-2xl font-bold text-success">{stream.pitch.feasibility_score.composite_score}%</p>
                      </div>
                    </div>

                    <div className="rounded-md border border-accent/35 bg-accent/10 p-3">
                      <h4 className="text-[11px] font-mono uppercase tracking-[0.12em] text-foreground/75">
                        SWARM PROTOCOL
                      </h4>
                      <div className="mt-2 space-y-2">
                        {stream.pitch.swarm_tasks.map((task, index) => (
                          <div
                            key={`${task.assignee}-${index}-${task.objective.slice(0, 18)}`}
                            className="rounded border border-border/80 bg-card/85 p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-foreground">{task.assignee}</span>
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.1em] text-foreground/70">
                                <span className={`h-2 w-2 rounded-full ${swarmStatusTone(swarmDispatched ? 'dispatched' : 'queued')}`} />
                                {swarmDispatched ? 'Dispatched' : 'Queued'}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-foreground/80 leading-relaxed">
                              {truncateText(firstSentence(task.objective), 95)}
                            </p>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSwarmDispatched(true)}
                        className={`mt-4 w-full rounded border px-3 py-2 text-xs font-mono font-bold uppercase tracking-[0.12em] transition ${
                          swarmDispatched
                            ? 'border-success/45 bg-success/15 text-success'
                            : 'border-accent/50 bg-accent/12 text-foreground hover:border-accent hover:bg-accent/20'
                        }`}
                      >
                        {swarmDispatched ? '[ SWARM DISPATCHED ]' : '[ DEPLOY SWARM WORKFLOW ]'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-border bg-card/70 p-3">
                    <p className="text-xs text-foreground/60">
                      {isHuntMode ? 'State matrix compiling...' : 'Feasibility and swarm protocol will render after lock.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {stream.error && <p className="font-mono text-danger mt-3 text-xs">{stream.error}</p>}
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App

