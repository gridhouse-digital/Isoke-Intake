import {
  buildAccessCode,
  buildCodeHash,
  buildStaffMessage,
  encryptAccessCode,
  extractLast4,
  getCodeEncryptionSecret,
  normalizeAccessCode,
  parsePositiveInteger,
} from '../_lib/intake.js'
import { verifyStaffToken } from '../_lib/staff-session.js'
import { getSupabaseAdmin } from '../_lib/supabase.js'

const STAFF_SEND_SUBJECT = 'Isoke Developmental Services Admissions / Intake Access Details'

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

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request)
    if (!token || !(await verifyStaffToken(token))) {
      return jsonResponse({ ok: false }, 401)
    }

    const body = (await request.json()) as {
      clientRef?: string
      expiresInDays?: number
      last4?: string
      maxUses?: number
      phone?: string
    }

    const resolvedLast4 = body.last4?.trim() || extractLast4(body.phone || '')
    if (!/^\d{4}$/.test(resolvedLast4)) {
      return jsonResponse({ ok: false, error: 'Provide a valid phone or a 4-digit last4 value.' }, 400)
    }

    const expiresInDays = parsePositiveInteger(body.expiresInDays, 14)
    const maxUses = parsePositiveInteger(body.maxUses, 5)
    const code = normalizeAccessCode(buildAccessCode(resolvedLast4))
    const pepper = process.env.CODE_HASH_PEPPER?.trim()

    if (!pepper) {
      return jsonResponse({ ok: false, error: 'CODE_HASH_PEPPER is not configured.' }, 500)
    }

    const clientName = body.clientRef?.trim() || ''
    const codeHash = buildCodeHash(code, pepper)
    const codeCiphertext = getCodeEncryptionSecret() ? encryptAccessCode(code, getCodeEncryptionSecret()) : null
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    const supabase = getSupabaseAdmin()

    let { error } = await supabase.from('intake_codes').insert({
      client_ref: body.clientRef?.trim() || null,
      code_hash: codeHash,
      code_ciphertext: codeCiphertext,
      expires_at: expiresAt,
      last4: resolvedLast4,
      max_uses: maxUses,
    })

    if (error?.message.includes('code_ciphertext')) {
      ;({ error } = await supabase.from('intake_codes').insert({
        client_ref: body.clientRef?.trim() || null,
        code_hash: codeHash,
        expires_at: expiresAt,
        last4: resolvedLast4,
        max_uses: maxUses,
      }))
    }

    if (error) {
      throw new Error(`Create code insert failed: ${error.message}`)
    }

    return jsonResponse({
      ok: true,
      code,
      expiresAt,
      messageTemplate: buildStaffMessage(code, clientName),
      subject: STAFF_SEND_SUBJECT,
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Code generation failed.' }, 500)
  }
}
