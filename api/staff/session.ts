import { verifyStaffToken } from '../_lib/staff-session'

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
  const token = getBearerToken(request)

  if (!token) {
    return jsonResponse({ ok: false }, 401)
  }

  const isValid = await verifyStaffToken(token)
  if (!isValid) {
    return jsonResponse({ ok: false }, 401)
  }

  return jsonResponse({ ok: true })
}
