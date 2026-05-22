import DOMPurify from 'dompurify'

const escapedHtmlPattern =
  /(?:&(?:amp;)?lt;|&#0*60;|&#x0*3c;)\s*\/?[a-z][\s\S]*?(?:&(?:amp;)?gt;|&#0*62;|&#x0*3e;)/i
const escapedQuoteWrapperPattern = /^(?:&quot;|&#0*34;|&#x0*22;).*(?:&quot;|&#0*34;|&#x0*22;)$/i
const htmlTagPattern = /<\/?[a-z][^>]*>/i
const unicodeEscapePattern = /\\u[0-9a-f]{4}/i
const quotePairs: Array<[string, string]> = [
  ['"', '"'],
  ["'", "'"],
  ['\u201c', '\u201d'],
  ['\u2018', '\u2019'],
  ['â€œ', 'â€'],
  ['â€˜', 'â€™'],
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function decodeHtmlEntities(value: string) {
  const doc = new DOMParser().parseFromString(value, 'text/html')
  return doc.documentElement.textContent || value
}

function looksLikeSerializedJson(value: string) {
  return (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']'))
  )
}

function formatDateParts(record: Record<string, unknown>) {
  const month = typeof record.month === 'string' ? record.month.trim() : ''
  const day = typeof record.day === 'string' ? record.day.trim() : ''
  const year = typeof record.year === 'string' ? record.year.trim() : ''
  const hour = typeof record.hour === 'string' ? record.hour.trim() : ''
  const minute = typeof record.minute === 'string' ? record.minute.trim() : ''
  const ampm = typeof record.ampm === 'string' ? record.ampm.trim() : ''

  if (!month && !day && !year) {
    return ''
  }

  const datePart = [month, day, year].filter(Boolean).join('/')
  const timePart = [hour, minute].filter(Boolean).join(':')
  return [datePart, [timePart, ampm].filter(Boolean).join(' ')].filter(Boolean).join(' ').trim()
}

function extractBestString(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    const bestHtml = value
      .map(item => extractBestString(item))
      .find(item => htmlTagPattern.test(item) || escapedHtmlPattern.test(item))

    if (bestHtml) {
      return bestHtml
    }

    return value
      .map(item => extractBestString(item))
      .filter(Boolean)
      .join(', ')
  }

  if (isRecord(value)) {
    const formattedDate = formatDateParts(value)
    if (formattedDate) {
      return formattedDate
    }

    for (const key of ['url', 'link', 'src', 'href', 'downloadUrl', 'download', 'image']) {
      if (typeof value[key] === 'string' && value[key].trim()) {
        return value[key].trim()
      }
    }

    for (const key of ['html', 'value', 'answer', 'prettyFormat', 'description', 'text', 'name']) {
      const candidate = extractBestString(value[key])
      if (candidate) {
        return candidate
      }
    }

    const first = typeof value.first === 'string' ? value.first.trim() : ''
    const last = typeof value.last === 'string' ? value.last.trim() : ''
    if (first || last) {
      return [first, last].filter(Boolean).join(' ')
    }

    return Object.values(value)
      .map(item => extractBestString(item))
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

function unwrapQuotedStringOnce(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  if (looksLikeSerializedJson(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const extracted = extractBestString(parsed)
      if (extracted) {
        return extracted
      }
    } catch {
      // Fall through to quote stripping.
    }
  }

  for (const [start, end] of quotePairs) {
    if (trimmed.startsWith(start) && trimmed.endsWith(end)) {
      return trimmed.slice(start.length, trimmed.length - end.length).trim()
    }
  }

  return trimmed
}

function stripWrappingQuotes(value: string) {
  let current = value.trim()

  for (let index = 0; index < 4; index += 1) {
    let stripped = false

    for (const [start, end] of quotePairs) {
      if (current.startsWith(start) && current.endsWith(end)) {
        current = current.slice(start.length, current.length - end.length).trim()
        stripped = true
        break
      }
    }

    if (!stripped) {
      break
    }
  }

  return current
}

function decodeUnicodeEscapes(value: string) {
  if (!unicodeEscapePattern.test(value)) {
    return value
  }

  return value.replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
}

export function extractSubmissionAnswerText(value: unknown) {
  return extractBestString(value)
}

export function normalizeSubmissionAnswer(value: string) {
  let current = value.trim()

  for (let index = 0; index < 6; index += 1) {
    const unwrapped = unwrapQuotedStringOnce(current)
    const quoteStripped = stripWrappingQuotes(unwrapped)
    const unicodeDecoded = decodeUnicodeEscapes(quoteStripped).trim()
    const shouldDecodeEntities = escapedHtmlPattern.test(unicodeDecoded) || escapedQuoteWrapperPattern.test(unicodeDecoded)
    const decodedEntities = shouldDecodeEntities ? decodeHtmlEntities(unicodeDecoded).trim() : unicodeDecoded
    const next = stripWrappingQuotes(decodedEntities)

    if (next === current) {
      break
    }

    current = next
  }

  return current
}

export function getSanitizedSubmissionAnswerHtml(value: unknown) {
  const extracted = extractSubmissionAnswerText(value)
  if (!extracted) {
    return null
  }

  const normalized = normalizeSubmissionAnswer(extracted)
  if (!htmlTagPattern.test(normalized)) {
    return null
  }

  return DOMPurify.sanitize(normalized, {
    USE_PROFILES: { html: true },
  })
}
