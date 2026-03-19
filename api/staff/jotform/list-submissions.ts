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

function stringifyAnswer(value: unknown): string {
  if (value == null) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(item => stringifyAnswer(item)).filter(Boolean).join(', ')
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.url === 'string') {
      return record.url
    }

    return Object.values(record)
      .map(item => stringifyAnswer(item))
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

function pickSubmissionTitle(answers: unknown) {
  if (!answers || typeof answers !== 'object') {
    return ''
  }

  const answerEntries = Object.values(answers as Record<string, unknown>)
  let best: { score: number; value: string } | null = null
  const fallbacks: string[] = []

  for (const entry of answerEntries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const record = entry as Record<string, unknown>
    const text = firstMeaningfulString(record.text)
    const answer = stringifyAnswer(record.answer)

    if (!answer) {
      continue
    }

    const label = text.toLowerCase()
    const value = answer.slice(0, 140)

    // Prefer explicit participant/client name fields (avoid matching any field that merely contains "participant").
    let score = 0
    if (label === 'full name') score += 120
    if (label.includes('participant') && label.includes('name')) score += 100
    if (label.includes('client') && label.includes('name')) score += 95
    if (label.includes('parent') && label.includes('name')) score += 90
    if (label.includes('guardian') && label.includes('name')) score += 90
    if (label === 'name') score += 80
    if (label.includes('first name')) score += 40
    if (label.includes('last name')) score += 35

    // Deprioritize things that commonly trip the heuristic.
    if (label.includes('insurance')) score -= 40
    if (label.includes('service')) score -= 20
    if (label.includes('check')) score -= 15
    if (label.includes('email')) score -= 10
    if (label.includes('phone')) score -= 10

    if (score > 0) {
      if (!best || score > best.score) {
        best = { score, value }
      }
      continue
    }

    fallbacks.push(value)
  }

  return best?.value || fallbacks[0] || ''
}

function pickSubmissionEmail(answers: unknown) {
  if (!answers || typeof answers !== 'object') {
    return ''
  }

  const answerEntries = Object.values(answers as Record<string, unknown>)
  let best = ''

  for (const entry of answerEntries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const record = entry as Record<string, unknown>
    const text = firstMeaningfulString(record.text).toLowerCase()
    const answer = stringifyAnswer(record.answer)

    if (!answer || !answer.includes('@')) {
      continue
    }

    if (text === 'email' || text === 'email address' || text.includes('email')) {
      best = answer
      break
    }
  }

  return best
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request)
    if (!token || !(await verifyStaffToken(token))) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const apiKey = process.env.JOTFORM_API_KEY?.trim()
    const formId = process.env.JOTFORM_FORM_ID?.trim()

    if (!apiKey || !formId) {
      return jsonResponse({ ok: false, error: 'Jotform API is not configured.' }, 500)
    }

    const body = (await request.json()) as {
      limit?: number
      offset?: number
      query?: string
    }

    const limit = Number.isFinite(body.limit) ? Math.min(Math.max(Number(body.limit), 1), 200) : 25
    const offset = Number.isFinite(body.offset) ? Math.max(Number(body.offset), 0) : 0
    const query = (body.query || '').trim().toLowerCase()

    const params = new URLSearchParams({
      apiKey,
      limit: String(limit),
      offset: String(offset),
    })

    const url = `https://api.jotform.com/form/${encodeURIComponent(formId)}/submissions?${params.toString()}`
    const response = await fetch(url, { method: 'GET' })
    const payload = (await response.json()) as {
      content?: unknown[]
      message?: string
      responseCode?: number
      resultSet?: { count?: number; limit?: number; offset?: number; total?: number }
    }

    if (!response.ok || payload.responseCode !== 200) {
      return jsonResponse(
        { ok: false, error: payload.message || `Jotform request failed: ${response.status}` },
        502,
      )
    }

    const submissions = (payload.content || [])
      .map(item => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const record = item as Record<string, unknown>
        const id = firstMeaningfulString(record.id)
        const createdAt =
          firstMeaningfulString(record.created_at) ||
          firstMeaningfulString(record.createdAt) ||
          new Date().toISOString()
        const title = pickSubmissionTitle(record.answers)
        const email = pickSubmissionEmail(record.answers)

        if (!id) {
          return null
        }

        return {
          id,
          createdAt,
          title: title || undefined,
          email: email || undefined,
        }
      })
      .filter(Boolean) as Array<{ id: string; createdAt: string; email?: string; title?: string }>

    const filtered = query
      ? submissions.filter(submission => {
          const haystack = `${submission.id} ${submission.title || ''} ${submission.email || ''}`.toLowerCase()
          return haystack.includes(query)
        })
      : submissions

    return jsonResponse({
      ok: true,
      submissions: filtered,
      offset: payload.resultSet?.offset ?? offset,
      total: payload.resultSet?.total ?? undefined,
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Unable to load submissions right now.' }, 500)
  }
}
