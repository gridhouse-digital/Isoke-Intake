import { describe, expect, it } from 'vitest'
import {
  ACCESS_CODE_ALPHABET,
  buildAccessCode,
  buildStaffMessage,
  extractLast4,
  normalizeAccessCode,
} from './intake'

describe('intake helpers', () => {
  it('normalizes access codes', () => {
    expect(normalizeAccessCode('  isoke-5313-k7m4q9  ')).toBe('ISOKE-5313-K7M4Q9')
  })

  it('extracts last four digits from phone input', () => {
    expect(extractLast4('(844) 476-5313')).toBe('5313')
    expect(extractLast4('53')).toBe('')
  })

  it('builds access code using supplied suffix', () => {
    expect(buildAccessCode('5313', 'K7M4Q9')).toBe('ISOKE-5313-K7M4Q9')
  })

  it('uses the typo-resistant alphabet', () => {
    expect(ACCESS_CODE_ALPHABET.includes('0')).toBe(false)
    expect(ACCESS_CODE_ALPHABET.includes('1')).toBe(false)
    expect(ACCESS_CODE_ALPHABET.includes('O')).toBe(false)
    expect(ACCESS_CODE_ALPHABET.includes('I')).toBe(false)
  })

  it('builds the staff message template with the generated code', () => {
    expect(buildStaffMessage('ISOKE-5313-K7M4Q9')).toContain('ISOKE-5313-K7M4Q9')
  })
})
