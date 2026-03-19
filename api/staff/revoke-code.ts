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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request)
    if (!token || !(await verifyStaffToken(token))) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const { id } = (await request.json()) as { id?: string }
    if (!id) {
      return jsonResponse({ ok: false, error: 'Code id is required.' }, 400)
    }

    if (!isUuid(id)) {
      return jsonResponse({ ok: false, error: 'Code id must be a valid UUID.' }, 400)
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('intake_codes')
      .update({ revoked: true })
      .eq('id', id)

    if (error) {
      throw new Error(`Revoke code failed: ${error.message}`)
    }

    return jsonResponse({ ok: true })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Unable to revoke this code right now.' }, 500)
  }
}
