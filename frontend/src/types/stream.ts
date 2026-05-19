export type WorkflowStatus = 'idle' | 'connecting' | 'connected' | 'completed' | 'error'

export interface MonologueEntry {
  text: string
  timestamp: string
}

export interface VadSnapshot {
  valence: number
  arousal: number
  dominance: number
}

export interface GrantCandidate {
  title: string
  opportunity_number: string
  agency: string
  close_date: string
  category: string
  description?: string
  award_ceiling?: string
  award_floor?: string
  post_date?: string
  url?: string
}

export interface PitchPayload {
  pitch_draft: string
  model_used: string
  status: string
}

export interface TreasuryStreamState {
  status: WorkflowStatus
  error: string | null
  monologueLog: MonologueEntry[]
  vad: VadSnapshot | null
  grants: GrantCandidate[]
  pitch: PitchPayload | null
  runQuery: (query: string) => void
}
