import { Fragment, useMemo, useState, type ReactNode } from 'react'

import { useTreasuryStream } from './hooks/useTreasuryStream'

type TelemetryLine = {
  id: string
  kind: 'thought' | 'vad' | 'json' | 'target'
  label: string
  content: string
  timestamp: string
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*)/g)
  return segments.map((segment, index) => {
    const isBold = segment.startsWith('**') && segment.endsWith('**') && segment.length > 4
    if (!isBold) {
      return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>
    }
    return (
      <strong key={`${segment}-${index}`} className="font-semibold text-white">
        {segment.slice(2, -2)}
      </strong>
    )
  })
}

function PitchMarkdown({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, paragraphIndex) => {
        const lines = paragraph.split('\n')
        return (
          <p key={`${paragraph}-${paragraphIndex}`} className="leading-relaxed text-sm text-blue-50/95">
            {lines.map((line, lineIndex) => (
              <Fragment key={`${line}-${lineIndex}`}>
                {renderInlineMarkdown(line)}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function App() {
  const stream = useTreasuryStream()
  const [businessContext, setBusinessContext] = useState('')
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false)

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

  const handleCommandOverride = () => {
    setHasTriedSubmit(true)
    if (!canExecute) {
      return
    }
    stream.runQuery(trimmedContext)
  }

  return (
    <div className="bg-background text-foreground scanline-overlay min-h-screen">
      <header className="border-border flex items-center justify-between border-b px-6 py-5">
        <div className="font-heading text-5xl uppercase tracking-[0.08em] leading-none">
          fervo<span className="flame-gradient-text">ai</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="font-mono text-foreground/70 text-xs uppercase tracking-[0.12em]">NODE: FERVOAI.TECH</div>
          <div className="font-mono text-xs uppercase tracking-[0.1em] text-emerald-300 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Link Established
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3">
        <section className="bg-card border-border xl:col-span-2 rounded border">
          <div className="bg-card border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-heading text-2xl uppercase tracking-[0.08em]">Cognitive Telemetry</h2>
            <span className="font-mono text-foreground/60 text-xs uppercase tracking-[0.12em]">{stream.status}</span>
          </div>

          <div className="log-scroll h-[70vh] overflow-y-auto p-4 font-mono text-sm">
            {telemetryLines.length === 0 && <p className="text-foreground/55">Awaiting stream handshake...</p>}

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
              <span className="cursor-blink ml-1 text-[#FFD82A]">_</span>
            </div>
          </div>
        </section>

        <aside className="bg-card border-border rounded border">
          <div className="bg-card border-border border-b px-4 py-3">
            <h2 className="font-heading text-2xl uppercase tracking-[0.08em]">Action &amp; Output</h2>
          </div>

          <div className="space-y-5 p-4">
            <div>
              <label className="font-heading text-foreground/60 mb-2 block text-sm uppercase tracking-[0.12em]">
                Core Business Context
              </label>
              <textarea
                value={businessContext}
                onChange={(event) => {
                  setBusinessContext(event.target.value)
                  if (hasTriedSubmit && event.target.value.trim()) {
                    setHasTriedSubmit(false)
                  }
                }}
                placeholder="B2B AI infrastructure for autonomous cloud optimization..."
                rows={5}
                className="bg-background border-border font-mono text-foreground placeholder:text-foreground/35 focus:border-[#FFD82A] focus:ring-[#FF2D2D]/30 w-full resize-none rounded border px-3 py-2 text-sm outline-none transition focus:ring-2"
              />
              {hasTriedSubmit && !canExecute && (
                <p className="font-mono text-[#FF2D2D] mt-2 text-xs">Context required to execute workflow.</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleCommandOverride}
              disabled={!canExecute}
              className="flame-gradient font-heading text-background disabled:text-background/50 disabled:cursor-not-allowed disabled:opacity-55 w-full rounded px-4 py-3 text-2xl uppercase tracking-[0.1em] shadow-[0_0_24px_rgba(255,216,42,0.25)]"
            >
              Command Override
            </button>

            <div className="rounded-xl border border-gray-800 bg-black/40 backdrop-blur-md">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-xl uppercase tracking-[0.08em] text-white">Active Target</h3>
                  <span className="rounded-full border border-emerald-400/50 bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.35)]">
                    TARGET ACQUIRED
                  </span>
                </div>
                {activeTarget ? (
                  <div className="mt-4 translate-y-0 space-y-4 opacity-100 transition-all duration-500 ease-out">
                    <h3 className="text-xl font-bold text-white">{activeTarget.title}</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Agency</p>
                        <p className="mt-1 text-sm text-gray-300">{activeTarget.agency}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Opportunity</p>
                        <p className="mt-1 text-sm text-gray-300">{activeTarget.opportunity_number}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500">Close Date</p>
                        <p className="mt-1 text-sm text-gray-300">{activeTarget.close_date}</p>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.12em] text-gray-400">Match Confidence</span>
                        <span className="text-sm font-semibold text-emerald-300">94%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-800">
                        <div className="h-full w-[94%] rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_14px_rgba(45,212,191,0.45)] transition-all duration-700 ease-out" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 translate-y-4 opacity-70 transition-all duration-500 ease-out">
                    <p className="text-sm text-gray-400">No opportunity selected yet.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-black/40 p-4 backdrop-blur-md">
              <h3 className="font-heading mb-2 text-xl uppercase tracking-[0.08em]">Latest Pitch</h3>
              {stream.pitch ? (
                <div className="translate-y-0 opacity-100 transition-all duration-500 ease-out">
                  <p className="font-mono text-foreground/60 mb-2 text-xs uppercase">
                    {stream.pitch.model_used} | {stream.pitch.status}
                  </p>
                  <div className="border-l-4 border-blue-500 bg-blue-900/10 px-4 py-3">
                    <PitchMarkdown text={stream.pitch.pitch_draft} />
                  </div>
                </div>
              ) : (
                <div className="translate-y-4 opacity-70 transition-all duration-500 ease-out">
                  <p className="font-body text-foreground/60 text-sm">No generated output yet.</p>
                </div>
              )}
              {stream.error && <p className="font-mono text-[#FF2D2D] mt-3 text-xs">{stream.error}</p>}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}

export default App
