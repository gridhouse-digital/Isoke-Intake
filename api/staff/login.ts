import bcrypt from 'bcryptjs'
import { signStaffToken } from '../_lib/staff-session.js'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request) {
  try {
    const { password } = (await request.json()) as { password?: string }
    const passwordHash = process.env.STAFF_PASSWORD_HASH?.trim()

    if (!password || !passwordHash) {
      return jsonResponse({ ok: false }, 401)
    }

    const matches = await bcrypt.compare(password, passwordHash)

    if (!matches) {
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
