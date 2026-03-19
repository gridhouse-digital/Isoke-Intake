import bcrypt from 'bcryptjs'
import { enforceRateLimit } from '../_lib/rate-limit.js'
import { sleep } from '../_lib/intake.js'
import { signStaffToken } from '../_lib/staff-session.js'

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
    const windowMs = Number(process.env.STAFF_LOGIN_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000)
    const max = Number(process.env.STAFF_LOGIN_RATE_LIMIT_MAX || 12)
    const ip = getClientIp(request)

    const rateLimit = await enforceRateLimit({
      ip,
      max,
      scope: 'staff_login',
      windowMs,
    })

    if (rateLimit.limited) {
      return jsonResponse({ ok: false, error: 'rate_limited' }, 429)
    }

    const { password } = (await request.json()) as { password?: string }
    const passwordHash = process.env.STAFF_PASSWORD_HASH?.trim()

    if (!password || !passwordHash) {
      await sleep(350)
      return jsonResponse({ ok: false }, 401)
    }

    const matches = await bcrypt.compare(password, passwordHash)

    if (!matches) {
      await sleep(350)
      return jsonResponse({ ok: false }, 401)
    }

    const staffToken = await signStaffToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    return jsonResponse({ ok: true, staffToken, expiresAt })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false }, 500)
  }
}
