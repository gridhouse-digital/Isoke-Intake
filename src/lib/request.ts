interface RequestJsonResult<T> {
  data: T | null
  errorMessage: string | null
  ok: boolean
  response: Response | null
  status: number
}

async function parseJsonSafely<T>(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function postJson<T>(
  url: string,
  body: unknown,
  init?: {
    headers?: HeadersInit
    networkErrorMessage?: string
  },
): Promise<RequestJsonResult<T>> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
      body: JSON.stringify(body),
    })

    const data = await parseJsonSafely<T>(response)

    return {
      data,
      errorMessage: response.ok ? null : null,
      ok: response.ok,
      response,
      status: response.status,
    }
  } catch {
    return {
      data: null,
      errorMessage: init?.networkErrorMessage || 'Unable to reach the API right now.',
      ok: false,
      response: null,
      status: 0,
    }
  }
}
