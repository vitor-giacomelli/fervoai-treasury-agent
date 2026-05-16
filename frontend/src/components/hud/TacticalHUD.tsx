import { motion } from 'framer-motion'

import type { TreasuryStreamState } from '../../types/stream'
import { Button } from '../ui/button'
import { MonologueTerminal } from './MonologueTerminal'

interface TacticalHUDProps {
  stream: TreasuryStreamState
}

export function TacticalHUD({ stream }: TacticalHUDProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-cyan-100">
      <div className="scanline-overlay" />
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 md:px-6">
        <header className="hud-panel mb-4 flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="font-mono text-lg uppercase tracking-[0.25em] text-cyan-300">FervoAI Treasury HUD</h1>
            <p className="font-mono text-xs text-cyan-100/60">Autonomous Enterprise Agent Interface</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded border border-cyan-400/40 px-2 py-1 font-mono text-xs uppercase tracking-widest text-cyan-200/90">
              {stream.status}
            </span>
            <Button onClick={stream.reconnect}>Restart Stream</Button>
          </div>
        </header>

        <section className="mb-4 grid flex-1 grid-cols-12 grid-rows-[minmax(160px,auto)_minmax(160px,auto)_minmax(280px,1fr)] gap-4">
          <article className="hud-panel col-span-12 row-span-1 md:col-span-4">
            <div className="hud-panel-header">
              <span className="text-xs uppercase tracking-widest text-cyan-200">VAD</span>
            </div>
            <div className="grid h-full grid-cols-3 gap-3 p-3 font-mono text-sm">
              <div className="rounded border border-cyan-500/20 bg-cyan-400/5 p-2">Valence: {stream.vad?.valence?.toFixed(2) ?? '--'}</div>
              <div className="rounded border border-cyan-500/20 bg-cyan-400/5 p-2">Arousal: {stream.vad?.arousal?.toFixed(2) ?? '--'}</div>
              <div className="rounded border border-cyan-500/20 bg-cyan-400/5 p-2">Dominance: {stream.vad?.dominance?.toFixed(2) ?? '--'}</div>
            </div>
          </article>

          <article className="hud-panel col-span-12 row-span-2 md:col-span-8">
            <div className="hud-panel-header">
              <span className="text-xs uppercase tracking-widest text-cyan-200">Grant Candidates</span>
              <span className="text-xs text-cyan-100/60">{stream.grants.length} selected</span>
            </div>
            <div className="space-y-2 p-3">
              {stream.grants.length === 0 && <p className="font-mono text-xs text-cyan-100/50">Waiting for filtered grants...</p>}
              {stream.grants.map((grant) => (
                <motion.div
                  key={grant.opportunity_number}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded border border-cyan-500/20 bg-cyan-400/5 p-3"
                >
                  <p className="font-mono text-xs uppercase tracking-wider text-amber-300">{grant.opportunity_number}</p>
                  <p className="mt-1 font-mono text-sm text-cyan-100">{grant.title}</p>
                  <p className="mt-1 font-mono text-xs text-cyan-100/70">{grant.agency} | {grant.close_date}</p>
                </motion.div>
              ))}
            </div>
          </article>

          <article className="hud-panel col-span-12 row-span-1 md:col-span-4">
            <div className="hud-panel-header">
              <span className="text-xs uppercase tracking-widest text-cyan-200">Pitch Draft</span>
            </div>
            <div className="p-3">
              {stream.pitch ? (
                <>
                  <p className="mb-2 font-mono text-xs text-cyan-100/60">
                    {stream.pitch.model_used} | {stream.pitch.status}
                  </p>
                  <p className="font-mono text-sm leading-relaxed text-cyan-100">{stream.pitch.pitch_draft}</p>
                </>
              ) : (
                <p className="font-mono text-xs text-cyan-100/50">Draft not generated yet.</p>
              )}
              {stream.error && <p className="mt-2 font-mono text-xs text-red-300">{stream.error}</p>}
            </div>
          </article>

          <MonologueTerminal entries={stream.monologueLog} />
        </section>
      </div>
    </main>
  )
}

