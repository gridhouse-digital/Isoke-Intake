export type VerifyFailureReason = 'expired' | 'invalid' | 'rate_limited' | 'revoked' | 'used'

export interface VerifyCodeResponse {
  ok: boolean
  reason?: VerifyFailureReason
}

export interface StaffLoginResponse {
  expiresAt?: string
  ok: boolean
  staffToken?: string
}

export interface StaffSessionResponse {
  ok: boolean
}

export interface CreateCodeResponse {
  code?: string
  error?: string
  expiresAt?: string
  ok: boolean
  messageTemplate?: string
  subject?: string
}

export interface CallbackResponse {
  error?: string
  ok: boolean
}

export interface SendCodeEmailResponse {
  error?: string
  ok: boolean
}

export interface StaffCodeRecord {
  clientRef: string | null
  code: string | null
  createdAt: string
  expiresAt: string
  id: string
  last4: string
  maxUses: number
  revoked: boolean
  status: 'active' | 'expired' | 'revoked' | 'used_up'
  usedCount: number
}

export interface ListCodesResponse {
  codes?: StaffCodeRecord[]
  error?: string
  ok: boolean
}

export interface RevokeCodeResponse {
  error?: string
  ok: boolean
}

export interface DeleteCodeResponse {
  error?: string
  ok: boolean
}

export interface JotformSubmissionSummary {
  createdAt: string
  email?: string
  id: string
  title?: string
}

export interface ListSubmissionsResponse {
  error?: string
  ok: boolean
  offset?: number
  submissions?: JotformSubmissionSummary[]
  total?: number
}

export interface JotformSubmissionDetail {
  answers?: Record<string, unknown>
  createdAt: string
  id: string
  raw?: Record<string, unknown>
  title?: string
}

export interface GetSubmissionResponse {
  error?: string
  ok: boolean
  submission?: JotformSubmissionDetail
}
