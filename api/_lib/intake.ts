import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto'

export const ACCESS_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

export function normalizeAccessCode(code: string) {
  return code.trim().toUpperCase()
}

export function buildCodeHash(code: string, pepper: string) {
  return createHash('sha256').update(`${normalizeAccessCode(code)}${pepper}`).digest('hex')
}

function deriveEncryptionKey(secret: string) {
  return createHash('sha256').update(secret).digest()
}

export function encryptAccessCode(code: string, secret: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveEncryptionKey(secret), iv)
  const encrypted = Buffer.concat([cipher.update(normalizeAccessCode(code), 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decryptAccessCode(payload: string | null | undefined, secret: string) {
  if (!payload) {
    return null
  }

  const [ivHex, authTagHex, encryptedHex] = payload.split(':')
  if (!ivHex || !authTagHex || !encryptedHex) {
    return null
  }

  try {
    const decipher = createDecipheriv('aes-256-gcm', deriveEncryptionKey(secret), Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch {
    return null
  }
}

export function extractLast4(input: string) {
  const digits = input.replace(/\D+/g, '')

  if (digits.length < 4) {
    return ''
  }

  return digits.slice(-4)
}

export function generateSuffix(length = 6) {
  let output = ''

  for (let index = 0; index < length; index += 1) {
    output += ACCESS_CODE_ALPHABET[randomInt(0, ACCESS_CODE_ALPHABET.length)]
  }

  return output
}

export function buildAccessCode(last4: string, suffix = generateSuffix()) {
  return `ISOKE-${last4}-${suffix}`
}

export function buildStaffMessage(code: string, clientName?: string) {
  const greetingName = clientName?.trim() ? ` ${clientName.trim()}` : ''

  return `Hello${greetingName},

You have been invited to complete the Isoke Developmental Services Admissions / Intake form.

Please use the secure link below to begin:
https://intake.isokedevelops.com

Your secure access code:
${code}

For privacy, please keep this code confidential and use it only for your admissions / intake form.

If you need assistance, please contact our Admissions Team at intake@isokedevelops.com or (844)-476-5313.
After-hours support: (844)-476-5313
Emergency after-hours: 267-983-8856

Kind regards,
Isoke Developmental Services
Admissions Team`
}

export function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function getCodeEncryptionSecret() {
  return process.env.CODE_ENCRYPTION_SECRET?.trim() || ''
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
