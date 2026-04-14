import { verifyStaffToken } from '../../_lib/staff-session.js'

function getBearerToken(request: Request) {
  const auth = request.headers.get('authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : ''
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function isAllowedJotformFileUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      /(^|\.)jotform\.com$/i.test(url.hostname) &&
      url.pathname.toLowerCase().includes('/uploads/')
    )
  } catch {
    return false
  }
}

async function fetchJotformFile(url: URL, apiKey: string) {
  const attempts = [
    () => fetch(url, { headers: { APIKEY: apiKey } }),
    () => {
      const withApiKey = new URL(url)
      if (!withApiKey.searchParams.has('apiKey')) {
        withApiKey.searchParams.set('apiKey', apiKey)
      }

      return fetch(withApiKey)
    },
    () => fetch(url),
  ]

  let lastResponse: Response | null = null
  for (const attempt of attempts) {
    const response = await attempt()
    lastResponse = response
    if (response.ok) {
      return response
    }
  }

  return lastResponse
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

    const body = (await request.json()) as { url?: string }
    const sourceUrl = body.url?.trim() || ''
    if (!sourceUrl || !isAllowedJotformFileUrl(sourceUrl)) {
      return jsonResponse({ ok: false, error: 'A valid Jotform uploads URL is required.' }, 400)
    }

    const upstream = await fetchJotformFile(new URL(sourceUrl), apiKey)
    if (!upstream?.ok) {
      return jsonResponse({ ok: false, error: 'Unable to load this Jotform file right now.' }, 502)
    }

    const headers = new Headers()
    const contentType = upstream.headers.get('content-type')
    if (contentType) {
      headers.set('Content-Type', contentType)
    }

    const contentLength = upstream.headers.get('content-length')
    if (contentLength) {
      headers.set('Content-Length', contentLength)
    }

    headers.set('Cache-Control', 'private, max-age=300')

    return new Response(upstream.body, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Unable to load this Jotform file right now.' }, 500)
  }
}
