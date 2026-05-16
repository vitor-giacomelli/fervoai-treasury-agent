import { useCallback, useEffect, useRef, useState } from 'react'

import type { GrantCandidate, MonologueEntry, PitchPayload, TreasuryStreamState, VadSnapshot, WorkflowStatus } from '../types/stream'

interface StreamEventEnvelope {
  type: string
  text?: string
  payload?: unknown
}

const DEV_DEFAULT_API_BASE_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  window.location.port === '5173'
    ? 'http://localhost:8000'
    : ''

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? DEV_DEFAULT_API_BASE_URL).replace(/\/$/, '')
const STREAM_URL = `${API_BASE_URL}/api/stream_workflow?query=start`

export function useTreasuryStream(): TreasuryStreamState {
  const [status, setStatus] = useState<WorkflowStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [monologueLog, setMonologueLog] = useState<MonologueEntry[]>([])
  const [vad, setVad] = useState<VadSnapshot | null>(null)
  const [grants, setGrants] = useState<GrantCandidate[]>([])
  const [pitch, setPitch] = useState<PitchPayload | null>(null)
  const sourceRef = useRef<EventSource | null>(null)
  const completedRef = useRef(false)
  const closingRef = useRef(false)

  const closeSource = useCallback((isExpectedClose = true) => {
    closingRef.current = isExpectedClose
    if (sourceRef.current) {
      sourceRef.current.close()
      sourceRef.current = null
    }
  }, [])

  const handleMessage = useCallback((event: MessageEvent<string>) => {
    try {
      const parsed = JSON.parse(event.data) as StreamEventEnvelope
      if (parsed.type === 'monologue' && parsed.text) {
        setMonologueLog((prev) => [{ text: parsed.text!, timestamp: new Date().toISOString() }, ...prev].slice(0, 120))
        return
      }
      if (parsed.type === 'vad' && parsed.payload && typeof parsed.payload === 'object') {
        const snapshot = parsed.payload as VadSnapshot
        setVad(snapshot)
        return
      }
      if (parsed.type === 'grant_candidate' && parsed.payload && typeof parsed.payload === 'object') {
        const grant = parsed.payload as GrantCandidate
        setGrants((prev) => {
          if (prev.some((item) => item.opportunity_number === grant.opportunity_number)) {
            return prev
          }
          return [...prev, grant]
        })
        return
      }
      if (parsed.type === 'pitch' && parsed.payload && typeof parsed.payload === 'object') {
        setPitch(parsed.payload as PitchPayload)
        return
      }
      if (parsed.type === 'error') {
        setStatus('error')
        setError(parsed.text ?? 'Unknown stream error.')
        closeSource()
        return
      }
      if (parsed.type === 'done') {
        completedRef.current = true
        setStatus('completed')
        closeSource()
      }
    } catch {
      setStatus('error')
      setError('Failed to parse SSE payload from backend.')
      closeSource()
    }
  }, [closeSource])

  const connect = useCallback(() => {
    closeSource()
    completedRef.current = false
    closingRef.current = false
    setStatus('connecting')
    setError(null)
    setMonologueLog([])
    setVad(null)
    setGrants([])
    setPitch(null)

    const source = new EventSource(STREAM_URL)
    sourceRef.current = source

    source.onopen = () => {
      setStatus('connected')
    }
    source.onmessage = handleMessage
    source.onerror = () => {
      if (completedRef.current || closingRef.current) {
        return
      }
      setStatus((prev) => (prev === 'completed' ? prev : 'error'))
      setError((prev) => prev ?? 'Connection lost while streaming workflow.')
      closeSource(false)
    }
  }, [closeSource, handleMessage])

  useEffect(() => {
    connect()
    return () => closeSource()
  }, [connect, closeSource])

  const reconnect = useCallback(() => {
    connect()
  }, [connect])

  return {
    status,
    error,
    monologueLog,
    vad,
    grants,
    pitch,
    reconnect,
  }
}
