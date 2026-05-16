import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import type { MonologueEntry } from '../../types/stream'

interface MonologueTerminalProps {
  entries: MonologueEntry[]
}

export function MonologueTerminal({ entries }: MonologueTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [entries])

  return (
    <section className="hud-panel col-span-12 row-span-1 flex min-h-0 flex-col">
      <header className="hud-panel-header">
        <span className="text-xs uppercase tracking-widest text-cyan-200">Monologue Terminal</span>
        <span className="text-xs text-cyan-100/60">Runtime Thought Stream</span>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-auto p-3 font-mono text-sm">
        <AnimatePresence initial={false}>
          {entries.map((entry, index) => (
            <motion.div
              key={`${entry.timestamp}-${index}`}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-2 border-b border-cyan-500/15 pb-2 last:border-0"
            >
              <div className="mb-1 text-[10px] text-cyan-100/50">{new Date(entry.timestamp).toLocaleTimeString()}</div>
              <div className="leading-relaxed text-cyan-100">
                <span className="mr-1 text-amber-300">{'>'}</span>
                {entry.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {entries.length === 0 && <p className="text-xs text-cyan-100/50">Awaiting internal monologue...</p>}
      </div>
    </section>
  )
}
