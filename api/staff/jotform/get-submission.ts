import { verifyStaffToken } from '../../_lib/staff-session.js'

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

function firstMeaningfulString(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  return trimmed
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request)
    if (!token || !(await verifyStaffToken(token))) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const apiKey = process.env.JOTFORM_API_KEY?.trim()
    if (!apiKey) {
      return jsonResponse({ ok: false, error: 'Jotform API is not configured.' }, 500)
    }

    const body = (await request.json()) as { submissionId?: string }
    const submissionId = body.submissionId?.trim()
    if (!submissionId) {
      return jsonResponse({ ok: false, error: 'submissionId is required.' }, 400)
    }

    const params = new URLSearchParams({ apiKey })
    const url = `https://api.jotform.com/submission/${encodeURIComponent(submissionId)}?${params.toString()}`
    const response = await fetch(url, { method: 'GET' })
    const payload = (await response.json()) as {
      content?: Record<string, unknown>
      message?: string
      responseCode?: number
    }

    if (!response.ok || payload.responseCode !== 200 || !payload.content) {
      return jsonResponse(
        { ok: false, error: payload.message || `Jotform request failed: ${response.status}` },
        502,
      )
    }

    const content = payload.content
    const createdAt =
      firstMeaningfulString(content.created_at) || firstMeaningfulString(content.createdAt) || new Date().toISOString()

    return jsonResponse({
      ok: true,
      submission: {
        id: submissionId,
        createdAt,
        title: undefined,
        answers: (content.answers as Record<string, unknown> | undefined) ?? undefined,
        raw: content,
      },
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Unable to load this submission right now.' }, 500)
  }
}

