import { useMemo } from 'react'

import { useTreasuryStream } from './hooks/useTreasuryStream'

type TelemetryLine = {
  kind: 'thought' | 'vad' | 'json'
  label: string
  content: string
  timestamp: string
}

function App() {
  const stream = useTreasuryStream()

  const telemetryLines = useMemo(() => {
    const thoughtLines: TelemetryLine[] = [...stream.monologueLog]
      .reverse()
      .map((entry) => ({
        kind: 'thought',
        label: 'THOUGHT',
        content: entry.text,
        timestamp: entry.timestamp,
      }))

    const vadLines: TelemetryLine[] = stream.vad
      ? [
          {
            kind: 'vad',
            label: 'VAD',
            content: `V:${stream.vad.valence.toFixed(2)} A:${stream.vad.arousal.toFixed(2)} D:${stream.vad.dominance.toFixed(2)}`,
            timestamp: new Date().toISOString(),
          },
        ]
      : []

    const payloadLines: TelemetryLine[] = []

    if (stream.grants[0]) {
      payloadLines.push({
        kind: 'json',
        label: 'TARGET_JSON',
        content: JSON.stringify(stream.grants[0], null, 0),
        timestamp: new Date().toISOString(),
      })
    }

    if (stream.pitch) {
      payloadLines.push({
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
        timestamp: new Date().toISOString(),
      })
    }

    return [...thoughtLines, ...vadLines, ...payloadLines]
  }, [stream.monologueLog, stream.vad, stream.grants, stream.pitch])

  const activeTarget = stream.grants[0] ?? null

  return (
    <div className="bg-background text-foreground scanline-overlay min-h-screen">
      <header className="border-border flex items-center justify-between border-b px-6 py-5">
        <div className="font-heading text-5xl uppercase tracking-[0.08em] leading-none">
          fervo<span className="flame-gradient-text">ai</span>
        </div>
        <div className="font-mono text-foreground/70 text-xs uppercase tracking-[0.12em]">NODE: FERVOAI.TECH</div>
      </header>

      <main className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3">
        <section className="bg-card border-border xl:col-span-2 rounded border">
          <div className="bg-[#0A0A0A] border-border flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-heading text-2xl uppercase tracking-[0.08em]">Cognitive Telemetry</h2>
            <span className="font-mono text-foreground/60 text-xs uppercase tracking-[0.12em]">{stream.status}</span>
          </div>

          <div className="log-scroll h-[70vh] overflow-y-auto p-4 font-mono text-sm">
            {telemetryLines.length === 0 && (
              <p className="text-foreground/55">Awaiting stream handshake...</p>
            )}

            {telemetryLines.map((line, index) => {
              const labelClass =
                line.kind === 'thought'
                  ? 'text-foreground/85'
                  : line.kind === 'vad'
                    ? 'text-[#FFD82A]'
                    : 'text-[#FF2D2D]/90'
              const bodyClass =
                line.kind === 'thought'
                  ? 'text-foreground/72'
                  : line.kind === 'vad'
                    ? 'text-[#FFD82A]/85'
                    : 'text-foreground/58'

              return (
                <div key={`${line.timestamp}-${line.label}-${index}`} className="border-border/50 mb-3 border-b pb-3 last:border-b-0">
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
          <div className="bg-[#0A0A0A] border-border border-b px-4 py-3">
            <h2 className="font-heading text-2xl uppercase tracking-[0.08em]">Action &amp; Output</h2>
          </div>

          <div className="space-y-5 p-4">
            <button
              type="button"
              onClick={stream.reconnect}
              className="flame-gradient font-heading text-background w-full rounded px-4 py-3 text-2xl uppercase tracking-[0.1em] shadow-[0_0_24px_rgba(255,216,42,0.25)]"
            >
              Command Override
            </button>

            <div className="bg-[#0A0A0A] border-border rounded border">
              <div className="flame-gradient h-1 w-full" />
              <div className="p-4">
                <h3 className="font-heading mb-2 text-xl uppercase tracking-[0.08em]">Active Target</h3>
                {activeTarget ? (
                  <div className="space-y-2">
                    <p className="font-mono text-foreground/80 text-xs uppercase tracking-[0.08em]">{activeTarget.opportunity_number}</p>
                    <p className="font-body text-foreground text-sm leading-relaxed">{activeTarget.title}</p>
                    <p className="font-body text-foreground/70 text-xs">{activeTarget.agency}</p>
                    <p className="font-mono text-foreground/55 text-xs">Close: {activeTarget.close_date}</p>
                  </div>
                ) : (
                  <p className="font-body text-foreground/60 text-sm">No opportunity selected yet.</p>
                )}
              </div>
            </div>

            <div className="bg-[#0A0A0A] border-border rounded border p-4">
              <h3 className="font-heading mb-2 text-xl uppercase tracking-[0.08em]">Latest Pitch</h3>
              {stream.pitch ? (
                <>
                  <p className="font-mono text-foreground/60 mb-2 text-xs uppercase">
                    {stream.pitch.model_used} | {stream.pitch.status}
                  </p>
                  <p className="font-body text-foreground/78 text-sm leading-relaxed">{stream.pitch.pitch_draft}</p>
                </>
              ) : (
                <p className="font-body text-foreground/60 text-sm">No generated output yet.</p>
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

