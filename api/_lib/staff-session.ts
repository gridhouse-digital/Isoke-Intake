import { SignJWT, jwtVerify } from 'jose'

const encoder = new TextEncoder()

function getSigningKey() {
  const secret = process.env.STAFF_SESSION_SIGNING_SECRET?.trim()

  if (!secret) {
    throw new Error('STAFF_SESSION_SIGNING_SECRET is not configured')
  }

  return encoder.encode(secret)
}

export async function signStaffToken() {
  return new SignJWT({ role: 'staff' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('60m')
    .sign(getSigningKey())
}

export async function verifyStaffToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSigningKey())
    return payload.role === 'staff'
  } catch {
    return false
  }
}
