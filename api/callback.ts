import { Resend } from 'resend'
import {
  DEFAULT_CALLBACK_EMAIL_FROM,
  buildCallbackEmailContent,
  buildCallbackEmailTags,
  normalizeEmailAddress,
  normalizeEnvValue,
  type CallbackPayload,
} from './_lib/callback-email-template.js'
import { sleep } from './_lib/intake.js'
import { enforceRateLimit } from './_lib/rate-limit.js'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }

  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function stripNewlines(value: string) {
  return value.replace(/\r?\n/g, ' ').trim()
}

function clampLength(value: string, max: number) {
  if (value.length <= max) {
    return value
  }

  return value.slice(0, max)
}

async function sendCallbackEmail(payload: CallbackPayload) {
  const apiKey = normalizeEnvValue(process.env.RESEND_API_KEY)
  const to = normalizeEmailAddress(process.env.CALLBACK_EMAIL_TO)
  const from = normalizeEmailAddress(process.env.CALLBACK_EMAIL_FROM) || DEFAULT_CALLBACK_EMAIL_FROM
  const replyTo = normalizeEmailAddress(process.env.CALLBACK_EMAIL_REPLY_TO)

  if (!apiKey || !to || !from) {
    return { ok: false as const, reason: 'email_not_configured' }
  }

  const resend = new Resend(apiKey)
  const email = buildCallbackEmailContent(payload)
  const response = await resend.emails.send({
    from,
    to: [to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    tags: buildCallbackEmailTags(payload),
    ...(replyTo ? { replyTo } : {}),
  })

  if (response.error) {
    throw new Error(`Resend email failed: ${response.error.message}`)
  }

  return { ok: true as const }
}

async function forwardCallbackWebhook(payload: CallbackPayload) {
  const webhook = process.env.CALLBACK_WEBHOOK_URL?.trim()

  if (!webhook) {
    return { ok: false as const, reason: 'webhook_not_configured' }
  }

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Callback webhook failed: ${response.status}`)
  }

  return { ok: true as const }
}

export async function POST(request: Request) {
  try {
    const windowMs = Number(process.env.CALLBACK_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000)
    const max = Number(process.env.CALLBACK_RATE_LIMIT_MAX || 10)
    const ip = getClientIp(request)

    const rateLimit = await enforceRateLimit({
      ip,
      max,
      scope: 'callback',
      windowMs,
    })

    if (rateLimit.limited) {
      return jsonResponse({ ok: false, error: 'rate_limited' }, 429)
    }

    const body = (await request.json()) as {
      bestTime?: string
      message?: string
      name?: string
      phone?: string
      service?: string
    }

    const name = stripNewlines(body.name?.trim() ?? '')
    const phone = stripNewlines(body.phone?.trim() ?? '')
    const bestTime = stripNewlines(body.bestTime?.trim() ?? '')
    const message = (body.message ?? '').trim()
    const service = stripNewlines(body.service?.trim() ?? 'intake_access_support')

    if (!name || !phone || !bestTime) {
      await sleep(200)
      return jsonResponse({ ok: false, error: 'name, phone, and bestTime are required' }, 400)
    }

    if (name.length > 120 || phone.length > 48 || bestTime.length > 120 || service.length > 80 || message.length > 2000) {
      await sleep(200)
      return jsonResponse({ ok: false, error: 'Request fields are too large.' }, 400)
    }

    const payload: CallbackPayload = {
      at: new Date().toISOString(),
      bestTime: clampLength(bestTime, 120),
      message: clampLength(message, 2000),
      name: clampLength(name, 120),
      phone: clampLength(phone, 48),
      service: clampLength(service, 80),
    }

    const [emailResult, webhookResult] = await Promise.all([sendCallbackEmail(payload), forwardCallbackWebhook(payload)])

    if (!emailResult.ok && !webhookResult.ok) {
      return jsonResponse({ ok: false, error: 'Callback delivery is not configured' }, 503)
    }

    return jsonResponse({
      ok: true,
      delivered: {
        email: emailResult.ok,
        webhook: webhookResult.ok,
      },
    })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Callback request failed' }, 500)
  }
}
