import { getSupabaseAdmin } from './supabase'

interface RateLimitOptions {
  ip: string
  max: number
  scope: string
  windowMs: number
}

export async function enforceRateLimit({ ip, scope, windowMs, max }: RateLimitOptions) {
  const supabase = getSupabaseAdmin()
  const now = new Date()
  const resetAt = new Date(now.getTime() - windowMs)

  const { data: existing, error: readError } = await supabase
    .from('intake_rate_limits')
    .select('attempt_count, window_started_at')
    .eq('scope', scope)
    .eq('ip_address', ip)
    .maybeSingle()

  if (readError) {
    throw new Error(`Rate limit lookup failed: ${readError.message}`)
  }

  if (!existing || new Date(existing.window_started_at) <= resetAt) {
    const { error: resetError } = await supabase.from('intake_rate_limits').upsert(
      {
        attempt_count: 1,
        ip_address: ip,
        scope,
        updated_at: now.toISOString(),
        window_started_at: now.toISOString(),
      },
      {
        onConflict: 'scope,ip_address',
      },
    )

    if (resetError) {
      throw new Error(`Rate limit reset failed: ${resetError.message}`)
    }

    return { limited: false, remaining: max - 1 }
  }

  if (existing.attempt_count >= max) {
    return { limited: true, remaining: 0 }
  }

  const nextCount = existing.attempt_count + 1
  const { error: updateError } = await supabase
    .from('intake_rate_limits')
    .update({
      attempt_count: nextCount,
      updated_at: now.toISOString(),
    })
    .eq('scope', scope)
    .eq('ip_address', ip)

  if (updateError) {
    throw new Error(`Rate limit update failed: ${updateError.message}`)
  }

  return { limited: false, remaining: Math.max(max - nextCount, 0) }
}
