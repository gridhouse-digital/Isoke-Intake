import { buildCodeHash, normalizeAccessCode, sleep } from './_lib/intake'
import { enforceRateLimit } from './_lib/rate-limit'
import { getSupabaseAdmin } from './_lib/supabase'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export async function POST(request: Request) {
  try {
    const verifyWindowMs = Number(process.env.VERIFY_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000)
    const verifyMax = Number(process.env.VERIFY_RATE_LIMIT_MAX || 10)
    const ip = getClientIp(request)

    const rateLimit = await enforceRateLimit({
      ip,
      max: verifyMax,
      scope: 'verify_code',
      windowMs: verifyWindowMs,
    })

    if (rateLimit.limited) {
      return jsonResponse({ ok: false, reason: 'rate_limited' }, 429)
    }

    const { code } = (await request.json()) as { code?: string }
    const normalized = normalizeAccessCode(code || '')
    const pepper = process.env.CODE_HASH_PEPPER?.trim()

    if (!normalized || !pepper) {
      await sleep(500)
      return jsonResponse({ ok: false, reason: 'invalid' }, 401)
    }

    const codeHash = buildCodeHash(normalized, pepper)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.rpc('verify_intake_code', {
      input_hash: codeHash,
    })

    if (error) {
      throw new Error(`verify_intake_code failed: ${error.message}`)
    }

    const result = Array.isArray(data) ? data[0] : data

    if (!result?.ok) {
      await sleep(650)
      return jsonResponse({ ok: false, reason: result?.reason || 'invalid' }, 401)
    }

    return jsonResponse({ ok: true })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, reason: 'invalid' }, 500)
  }
}
