import { describe, expect, it } from 'vitest'
import { extractSubmissionAnswerText, getSanitizedSubmissionAnswerHtml, normalizeSubmissionAnswer } from './jotformRichText'

describe('normalizeSubmissionAnswer', () => {
  it('unwraps JSON-encoded HTML strings', () => {
    const value = '"<p>Agreement</p><ul><li>One</li></ul>"'

    expect(normalizeSubmissionAnswer(value)).toBe('<p>Agreement</p><ul><li>One</li></ul>')
  })

  it('decodes double-escaped HTML payloads from Jotform', () => {
    const value = '&quot;&amp;lt;p&amp;gt;Agreement&amp;lt;/p&amp;gt;&quot;'

    expect(normalizeSubmissionAnswer(value)).toBe('<p>Agreement</p>')
  })

  it('unwraps JSON objects that carry the html inside a nested value field', () => {
    const value = '{"value":"<p>Agreement</p><ul><li>One</li></ul>"}'

    expect(normalizeSubmissionAnswer(value)).toBe('<p>Agreement</p><ul><li>One</li></ul>')
  })

  it('decodes unicode-escaped html strings', () => {
    const value = '\\u003Cp\\u003EAgreement\\u003C/p\\u003E'

    expect(normalizeSubmissionAnswer(value)).toBe('<p>Agreement</p>')
  })

  it('unwraps quoted html strings with embedded attribute quotes', () => {
    const value =
      '"<p><br />By signing this agreement, I authorize Isoke Developmental Services<br />LLC (“the Agency”) to provide Home and Community-Based Services as<br />outlined in my Individual Support Plan (ISP).<br /><br /></p> <p><em><strong>I understand that:</strong></em></p> <ul style=\\"list-style-type: square;\\"> <li>Services will be delivered according to my ISP and 55 Pa. Code<br />Chapter 6100.</li> <li>I may choose or change my service provider at any time. - I remain under the care and oversight of my primary physician and<br />Supports Coordinator.</li> <li>The agency will collaborate with my Supports Coordinator to ensure<br />services meet my needs and goals.</li> <li>This agreement will be reviewed and updated whenever there is a<br />change in my ISP or at the request of the AE or ODP.</li> </ul>"'

    expect(normalizeSubmissionAnswer(value)).toContain('<p><br />By signing this agreement')
    expect(getSanitizedSubmissionAnswerHtml(value)).toContain('<ul')
    expect(getSanitizedSubmissionAnswerHtml(value)).toContain('<strong>I understand that:</strong>')
  })

  it('leaves plain text as plain text', () => {
    const value = '"Needs a callback this week."'

    expect(normalizeSubmissionAnswer(value)).toBe('Needs a callback this week.')
    expect(getSanitizedSubmissionAnswerHtml(value)).toBeNull()
  })
})

describe('getSanitizedSubmissionAnswerHtml', () => {
  it('returns sanitized html for rich text answers', () => {
    const value = '<p>Hello <strong>world</strong></p>'

    expect(getSanitizedSubmissionAnswerHtml(value)).toBe('<p>Hello <strong>world</strong></p>')
  })

  it('strips unsafe markup before rendering', () => {
    const value = '<p>Safe</p><script>alert(1)</script><img src=x onerror=alert(1) />'
    const sanitized = getSanitizedSubmissionAnswerHtml(value)

    expect(sanitized).toContain('<p>Safe</p>')
    expect(sanitized).not.toContain('<script>')
    expect(sanitized).not.toContain('onerror=')
  })

  it('renders html nested inside object answers', () => {
    const value = { value: '<p>Agreement</p><ul><li>One</li></ul>' }

    expect(getSanitizedSubmissionAnswerHtml(value)).toBe('<p>Agreement</p><ul><li>One</li></ul>')
  })
})

describe('extractSubmissionAnswerText', () => {
  it('formats Jotform date parts cleanly', () => {
    const value = { month: '03', day: '19', year: '2026' }

    expect(extractSubmissionAnswerText(value)).toBe('03/19/2026')
  })

  it('formats Jotform date-time parts cleanly', () => {
    const value = { month: '03', day: '19', year: '2026', hour: '09', minute: '30', ampm: 'PM' }

    expect(extractSubmissionAnswerText(value)).toBe('03/19/2026 09:30 PM')
  })
})
