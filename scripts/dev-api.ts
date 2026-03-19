import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { POST as callbackPost } from '../api/callback.ts'
import { POST as verifyCodePost } from '../api/verify-code.ts'
import { POST as staffCreateCodePost } from '../api/staff/create-code.ts'
import { POST as staffDeleteCodePost } from '../api/staff/delete-code.ts'
import { POST as staffListCodesPost } from '../api/staff/list-codes.ts'
import { POST as staffLoginPost } from '../api/staff/login.ts'
import { POST as staffRevokeCodePost } from '../api/staff/revoke-code.ts'
import { POST as staffSessionPost } from '../api/staff/session.ts'
import { POST as staffSendCodeEmailPost } from '../api/staff/send-code-email.ts'
import { POST as jotformGetSubmissionPost } from '../api/staff/jotform/get-submission.ts'
import { POST as jotformListSubmissionsPost } from '../api/staff/jotform/list-submissions.ts'

const PORT = 3001
const routeHandlers = new Map<string, (request: Request) => Promise<Response>>([
  ['/api/callback', callbackPost],
  ['/api/staff/create-code', staffCreateCodePost],
  ['/api/staff/delete-code', staffDeleteCodePost],
  ['/api/staff/jotform/get-submission', jotformGetSubmissionPost],
  ['/api/staff/jotform/list-submissions', jotformListSubmissionsPost],
  ['/api/staff/list-codes', staffListCodesPost],
  ['/api/staff/login', staffLoginPost],
  ['/api/staff/revoke-code', staffRevokeCodePost],
  ['/api/staff/session', staffSessionPost],
  ['/api/staff/send-code-email', staffSendCodeEmailPost],
  ['/api/verify-code', verifyCodePost],
])

function loadEnvFile(filename: string) {
  const envPath = resolve(process.cwd(), filename)
  if (!existsSync(envPath)) {
    return
  }

  const content = readFileSync(envPath, 'utf8')
  content.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) {
      return
    }

    const key = match[1].trim()
    const rawValue = match[2].trim()
    const normalized = rawValue.startsWith('"') || rawValue.startsWith("'")
      ? rawValue.replace(/^["']|["']$/g, '')
      : rawValue.split(/\s+#/)[0]?.trim() || ''

    process.env[key] = normalized
  })
}

function loadEnv() {
  loadEnvFile('.env')
  loadEnvFile('.env.local')
}

function withCorsHeaders(origin: string | undefined, headers: Headers) {
  if (origin === 'http://localhost:5173') {
    headers.set('Access-Control-Allow-Origin', origin)
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }

  return headers
}

function normalizePath(url: string | undefined) {
  if (!url) {
    return '/'
  }

  return url.endsWith('/') && url !== '/' ? url.slice(0, -1) : url
}

loadEnv()

const server = createServer(async (req, res) => {
  const origin = req.headers.origin
  const requestHeaders = new Headers()

  Object.entries(req.headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => requestHeaders.append(key, item))
      return
    }

    if (typeof value === 'string') {
      requestHeaders.set(key, value)
    }
  })

  if (req.method === 'OPTIONS') {
    const headers = withCorsHeaders(origin, new Headers())
    res.writeHead(204, Object.fromEntries(headers.entries()))
    res.end()
    return
  }

  const path = normalizePath(req.url)

  if (req.method === 'GET' && path === '/health') {
    const headers = withCorsHeaders(origin, new Headers({ 'Content-Type': 'application/json' }))
    res.writeHead(200, Object.fromEntries(headers.entries()))
    res.end(JSON.stringify({ ok: true }))
    return
  }

  const handler = routeHandlers.get(path)
  if (!handler || req.method !== 'POST') {
    const headers = withCorsHeaders(origin, new Headers({ 'Content-Type': 'application/json' }))
    res.writeHead(404, Object.fromEntries(headers.entries()))
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  let body = ''
  for await (const chunk of req) {
    body += chunk
  }

  try {
    const request = new Request(`http://localhost:${PORT}${path}`, {
      method: 'POST',
      headers: requestHeaders,
      body: body || undefined,
    })

    const response = await handler(request)
    const headers = withCorsHeaders(origin, new Headers(response.headers))
    const responseText = await response.text()

    res.writeHead(response.status, Object.fromEntries(headers.entries()))
    res.end(responseText)
  } catch (error) {
    console.error(error)
    const headers = withCorsHeaders(origin, new Headers({ 'Content-Type': 'application/json' }))
    res.writeHead(500, Object.fromEntries(headers.entries()))
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Request failed' }))
  }
})

server.listen(PORT, () => {
  console.log(`[dev-api] Intake API on http://localhost:${PORT}`)
  console.log(`[dev-api] Verify code on http://localhost:${PORT}/api/verify-code`)
  console.log(`[dev-api] Staff login on http://localhost:${PORT}/api/staff/login`)
  console.log(`[dev-api] Staff create-code on http://localhost:${PORT}/api/staff/create-code`)
  console.log(`[dev-api] Staff delete-code on http://localhost:${PORT}/api/staff/delete-code`)
  console.log(`[dev-api] Staff jotform list-submissions on http://localhost:${PORT}/api/staff/jotform/list-submissions`)
  console.log(`[dev-api] Staff jotform get-submission on http://localhost:${PORT}/api/staff/jotform/get-submission`)
  console.log(`[dev-api] Staff list-codes on http://localhost:${PORT}/api/staff/list-codes`)
  console.log(`[dev-api] Staff revoke-code on http://localhost:${PORT}/api/staff/revoke-code`)
  console.log(`[dev-api] Staff session on http://localhost:${PORT}/api/staff/session`)
  console.log(`[dev-api] Staff send-code-email on http://localhost:${PORT}/api/staff/send-code-email`)
  console.log(`[dev-api] Callback on http://localhost:${PORT}/api/callback`)
})
