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
