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
  recipient_email?: string
  url?: string
}

export interface FeasibilityScore {
  technical_fit: number
  compliance_readiness: number
  capital_efficiency: number
  execution_confidence: number
  composite_score: number
  rationale: string
}

export interface SwarmTask {
  assignee: string
  objective: string
  domain_alignment: string
  expected_output: string
  priority: string
  status: string
}

export interface PitchPayload {
  pitch_draft: string
  model_used: string
  status: string
  feasibility_score: FeasibilityScore
  swarm_tasks: SwarmTask[]
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
