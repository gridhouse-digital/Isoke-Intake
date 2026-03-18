import { decryptAccessCode, getCodeEncryptionSecret } from '../_lib/intake.js'
import { verifyStaffToken } from '../_lib/staff-session.js'
import { getSupabaseAdmin } from '../_lib/supabase.js'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getBearerToken(request: Request) {
  const auth = request.headers.get('authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : ''
}

function resolveStatus(code: {
  expires_at: string
  max_uses: number
  revoked: boolean
  used_count: number
}) {
  if (code.revoked) {
    return 'revoked' as const
  }

  if (new Date(code.expires_at).getTime() < Date.now()) {
    return 'expired' as const
  }

  if (code.used_count >= code.max_uses) {
    return 'used_up' as const
  }

  return 'active' as const
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request)
    if (!token || !(await verifyStaffToken(token))) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const supabase = getSupabaseAdmin()
    type IntakeCodeRow = {
      client_ref: string | null
      code_ciphertext?: string | null
      created_at: string
      expires_at: string
      id: string
      last4: string
      max_uses: number
      revoked: boolean
      used_count: number
    }

    let data: IntakeCodeRow[] | null = null
    let error: { message: string } | null = null

    const firstQuery = await supabase
      .from('intake_codes')
      .select('id, last4, client_ref, code_ciphertext, expires_at, max_uses, used_count, revoked, created_at')
      .order('created_at', { ascending: false })
      .limit(25)
    data = firstQuery.data as IntakeCodeRow[] | null
    error = firstQuery.error

    const hasCiphertextColumn = !error

    if (error?.message.includes('code_ciphertext')) {
      const fallbackQuery = await supabase
        .from('intake_codes')
        .select('id, last4, client_ref, expires_at, max_uses, used_count, revoked, created_at')
        .order('created_at', { ascending: false })
        .limit(25)
      data = fallbackQuery.data as IntakeCodeRow[] | null
      error = fallbackQuery.error
    }

    if (error) {
      throw new Error(`List codes failed: ${error.message}`)
    }

    const codes = (data || []).map(code => ({
      code: hasCiphertextColumn
        ? decryptAccessCode((code as { code_ciphertext?: string | null }).code_ciphertext, getCodeEncryptionSecret())
        : null,
      id: code.id,
      last4: code.last4,
      clientRef: code.client_ref,
      expiresAt: code.expires_at,
      maxUses: code.max_uses,
      usedCount: code.used_count,
      revoked: code.revoked,
      createdAt: code.created_at,
      status: resolveStatus(code),
    }))

    return jsonResponse({ ok: true, codes })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Unable to load generated codes right now.' }, 500)
  }
}
