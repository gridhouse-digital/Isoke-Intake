export const INTAKE_UNLOCKED_KEY = 'intakeUnlocked'
export const STAFF_TOKEN_KEY = 'staffToken'

export function getSessionFlag(key: string) {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.sessionStorage.getItem(key) ?? ''
}

export function setSessionFlag(key: string, value: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(key, value)
}

export function clearSessionFlag(key: string) {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(key)
}
