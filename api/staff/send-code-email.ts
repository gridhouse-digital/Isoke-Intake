import { Resend } from 'resend'
import { DEFAULT_CALLBACK_EMAIL_FROM, normalizeEmailAddress, normalizeEnvValue } from '../_lib/callback-email-template'
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function textToHtml(value: string) {
  return escapeHtml(value).replaceAll('\n', '<br />')
}

export async function POST(request: Request) {
  try {
    const token = getBearerToken(request)
    if (!token || !(await verifyStaffToken(token))) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401)
    }

    const body = (await request.json()) as {
      message?: string
      subject?: string
      to?: string
    }

    const apiKey = normalizeEnvValue(process.env.RESEND_API_KEY)
    const from =
      normalizeEmailAddress(process.env.INTAKE_CODE_EMAIL_FROM) ||
      normalizeEmailAddress(process.env.CALLBACK_EMAIL_FROM) ||
      DEFAULT_CALLBACK_EMAIL_FROM
    const replyTo =
      normalizeEmailAddress(process.env.INTAKE_CODE_EMAIL_REPLY_TO) ||
      normalizeEmailAddress(process.env.CALLBACK_EMAIL_REPLY_TO)
    const to = normalizeEmailAddress(body.to)
    const subject = normalizeEnvValue(body.subject)
    const message = (body.message || '').trim()

    if (!apiKey || !to || !subject || !message) {
      return jsonResponse({ ok: false, error: 'Email configuration or message details are missing.' }, 400)
    }

    const resend = new Resend(apiKey)
    const response = await resend.emails.send({
      from,
      to: [to],
      subject,
      text: message,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.7; color: #221735;">${textToHtml(message)}</div>`,
      ...(replyTo ? { replyTo } : {}),
    })

    if (response.error) {
      throw new Error(`Resend send-code-email failed: ${response.error.message}`)
    }

    return jsonResponse({ ok: true })
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Unable to send the intake email right now.' }, 500)
  }
}
