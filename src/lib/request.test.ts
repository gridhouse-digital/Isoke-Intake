import { afterEach, describe, expect, it, vi } from 'vitest'
import { postJson } from './request'

describe('postJson', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed json for successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    )

    const result = await postJson<{ ok: boolean }>('/api/test', {})
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ ok: true })
  })

  it('does not throw on empty non-json responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })))

    const result = await postJson<{ ok: boolean }>('/api/test', {})
    expect(result.ok).toBe(false)
    expect(result.data).toBeNull()
  })

  it('returns a readable network error message on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

    const result = await postJson<{ ok: boolean }>('/api/test', {}, {
      networkErrorMessage: 'Local API is not running.',
    })

    expect(result.ok).toBe(false)
    expect(result.errorMessage).toBe('Local API is not running.')
    expect(result.response).toBeNull()
  })
})
