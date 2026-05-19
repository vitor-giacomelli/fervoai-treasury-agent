import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Button } from './components/ui/button'
import { useTreasuryStream } from './hooks/useTreasuryStream'

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
  const [swarmDispatched, setSwarmDispatched] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const telemetryTerminalRef = useRef<HTMLDivElement | null>(null)
  const deployTimeoutRef = useRef<number | null>(null)

  const trimmedContext = businessContext.trim()
  const canExecute = trimmedContext.length > 0

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
  const phase: 'hunt' | 'locked' | 'idle' = isHuntMode ? 'hunt' : isLockMode ? 'locked' : 'idle'

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

  const handleDeploySwarm = () => {
    if (swarmDispatched || isDeploying) {
      return
    }
    setIsDeploying(true)
    if (deployTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(deployTimeoutRef.current)
    }
    if (typeof window !== 'undefined') {
      deployTimeoutRef.current = window.setTimeout(() => {
        setSwarmDispatched(true)
        setIsDeploying(false)
        deployTimeoutRef.current = null
      }, 1800)
    }
  }

  useEffect(() => {
    if (stream.status !== 'completed') {
      setSwarmDispatched(false)
      setIsDeploying(false)
      if (deployTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(deployTimeoutRef.current)
        deployTimeoutRef.current = null
      }
    }
  }, [stream.status, stream.pitch])

  useEffect(() => {
    if (!isHuntMode || !telemetryTerminalRef.current) {
      return
    }
    telemetryTerminalRef.current.scrollTop = telemetryTerminalRef.current.scrollHeight
  }, [isHuntMode, stream.monologueLog])

  useEffect(() => {
    return () => {
      if (deployTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(deployTimeoutRef.current)
        deployTimeoutRef.current = null
      }
    }
  }, [])

  return (
    <div className="bg-background text-foreground scanline-overlay min-h-screen">
      <header className="border-border border-b px-4 py-6 sm:px-6">
        <h1 className="mx-auto max-w-5xl text-center font-heading text-2xl font-bold tracking-[0.03em] text-foreground sm:text-3xl">
          Treasury Agent autonomously finds, scores, and routes federal grant execution.
        </h1>
      </header>

      <main className="grid grid-cols-1 gap-4 p-4 sm:gap-6 sm:p-6 xl:grid-cols-3">
        {phase === 'hunt' ? (
          <section className="order-1 xl:col-span-3 rounded border border-emerald-900/50 bg-black/90 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
            <div className="flex items-center justify-between border-b border-emerald-900/50 px-4 py-3">
              <h2 className="font-heading text-xl uppercase tracking-[0.08em] text-emerald-300">Cognitive Telemetry</h2>
              <span className="font-mono text-emerald-400/80 text-xs uppercase tracking-[0.12em]">{stream.status}</span>
            </div>

            <div
              ref={telemetryTerminalRef}
              className="h-64 overflow-y-auto bg-black border border-emerald-900/50 p-4 font-mono text-xs"
            >
              {stream.monologueLog.length === 0 ? (
                <p className="text-emerald-500/70">&gt; [ SYSTEM EVENT ] Awaiting workflow handshake...</p>
              ) : (
                [...stream.monologueLog].reverse().map((entry, index) => (
                  <p key={`${entry.timestamp}-${index}-${entry.text.slice(0, 16)}`} className="mb-1 text-emerald-400/90">
                    &gt; [{new Date(entry.timestamp).toLocaleTimeString()}] [ SYSTEM EVENT ] {entry.text}
                  </p>
                ))
              )}
              <p className="text-emerald-500/70">
                &gt; [ STREAM ] <span className="cursor-blink">_</span>
              </p>
            </div>
          </section>
        ) : (
          <>
            <section className={`order-1 xl:col-span-3 rounded border px-4 py-3 transition-all duration-500 ${
              isLockMode
                ? 'border-success/40 bg-success/10 shadow-[0_0_20px_hsl(var(--success)/0.2)]'
                : 'border-border bg-card/70'
            }`}>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-foreground/70">
                {isLockMode
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

            <aside
              className={`order-1 md:order-2 rounded border transition-all duration-500 ${
                isLockMode
                  ? 'bg-card border-success/35 shadow-[0_0_20px_hsl(var(--success)/0.18)] opacity-100'
                  : 'bg-card border-border'
              } xl:col-span-3`}
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
                      <p className="text-sm text-muted">No opportunity selected yet.</p>
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
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded border border-border/70 bg-card/80 px-2 py-1 text-[10px] font-mono text-foreground/65">
                              ✓ Live Grants.gov S2S Data
                            </span>
                            <span className="inline-flex items-center rounded border border-border/70 bg-card/80 px-2 py-1 text-[10px] font-mono text-foreground/65">
                              ✓ Gemini Feasibility Scored
                            </span>
                            <span className="inline-flex items-center rounded border border-border/70 bg-card/80 px-2 py-1 text-[10px] font-mono text-foreground/65">
                              ✓ fervo_state.json Loaded
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={swarmDispatched || isDeploying}
                            onClick={handleDeploySwarm}
                            className={`mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all uppercase tracking-widest flex items-center justify-center ${
                              swarmDispatched ? 'opacity-95' : ''
                            } ${isDeploying ? 'animate-pulse cursor-wait' : ''} ${
                              swarmDispatched ? 'cursor-default' : ''
                            }`}
                          >
                            {isDeploying ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="h-4 w-4 rounded-full border-2 border-white/45 border-t-white animate-spin" />
                                [ INITIATING SWARM PROTOCOLS... ]
                              </span>
                            ) : swarmDispatched ? '[ SWARM DISPATCHED ]' : '[ DEPLOY SWARM WORKFLOW ]'}
                          </button>
                          {swarmDispatched ? (
                            <div className="mt-4 p-3 bg-black border border-emerald-900/50 rounded text-xs font-mono text-emerald-400 space-y-1">
                              <p>&gt; SUCCESS: Jira Epic created and assigned to Vitor (Tech Lead).</p>
                              <p>&gt; SUCCESS: Slack notification routed to Alexa (COO).</p>
                              <p>&gt; SUCCESS: S2S XML Payload staged by Treasury Sub-Agent.</p>
                              <p>&gt; Swarm orchestration complete. Awaiting human execution.</p>
                              <p className="pt-1 text-emerald-300 font-bold tracking-[0.05em]">
                                &gt; SWARM ORCHESTRATION COMPLETE. HUMAN APPROVAL IS NOW THE ONLY BLOCKER.
                              </p>
                            </div>
                          ) : null}
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
          </>
        )}
      </main>
    </div>
  )
}

export default App

