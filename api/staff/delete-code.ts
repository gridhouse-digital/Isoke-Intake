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

    const supabase = getSupabaseAdmin()
    const { data: existing, error: readError } = await supabase
      .from('intake_codes')
      .select('id, revoked')
      .eq('id', id)
      .maybeSingle()

    if (readError) {
      throw new Error(`Delete code lookup failed: ${readError.message}`)
    }

    if (!existing) {
      return jsonResponse({ ok: false, error: 'Code not found.' }, 404)
    }

    if (!existing.revoked) {
      return jsonResponse({ ok: false, error: 'Only revoked codes can be deleted.' }, 400)
    }

    const { error } = await supabase.from('intake_codes').delete().eq('id', id)

    if (error) {
      throw new Error(`Delete code failed: ${error.message}`)
    }

    return jsonResponse({ ok: true })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Unable to delete this code right now.' }, 500)
  }
}
