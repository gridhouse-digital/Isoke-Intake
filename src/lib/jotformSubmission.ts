import {
  extractSubmissionAnswerText,
  getSanitizedSubmissionAnswerHtml,
  normalizeSubmissionAnswer,
} from './jotformRichText'

export type NormalizedSubmissionRow =
  | {
      kind: 'field'
      answerText: string
      label: string
      order: number
    }
  | {
      kind: 'html_block'
      html: string
      order: number
    }
  | {
      kind: 'image'
      alt: string
      imageUrl: string
      label: string
      order: number
    }
  | {
      kind: 'section'
      order: number
      title: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isImageUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  try {
    const url = new URL(trimmed)
    const pathname = url.pathname.toLowerCase()
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

function isHiddenStructuralField(label: string, answer: string) {
  const normalizedLabel = label.trim().toLowerCase()
  return (normalizedLabel === 'page break' || normalizedLabel === 'continue') && (!answer || answer === '-')
}

function isSectionHeading(label: string, answer: string) {
  if (!label.trim() || (answer && answer !== '-')) {
    return false
  }

  const normalized = label.trim()
  const wordCount = normalized.split(/\s+/).length
  if (wordCount > 8) {
    return false
  }

  if (/[?:,]/.test(normalized)) {
    return false
  }

  return true
}

function rowOrder(entry: Record<string, unknown>) {
  const order = typeof entry.order === 'string' ? Number(entry.order) : Number(entry.order)
  return Number.isFinite(order) ? order : 9999
}

export function normalizeJotformSubmissionRows(answers: unknown): NormalizedSubmissionRow[] {
  if (!isRecord(answers)) {
    return []
  }

  return Object.values(answers)
    .map(entry => {
      if (!isRecord(entry)) {
        return null
      }

      const order = rowOrder(entry)
      const rawText = typeof entry.text === 'string' ? entry.text.trim() : ''
      const rawAnswer = entry.answer
      const answer = extractSubmissionAnswerText(rawAnswer)
      const htmlFromText = !answer ? getSanitizedSubmissionAnswerHtml(rawText) : null

      if (isHiddenStructuralField(rawText, answer)) {
        return null
      }

      if (htmlFromText) {
        return {
          kind: 'html_block',
          html: htmlFromText,
          order,
        } satisfies NormalizedSubmissionRow
      }

      if (isSectionHeading(rawText, answer)) {
        return {
          kind: 'section',
          order,
          title: rawText,
        } satisfies NormalizedSubmissionRow
      }

      if (!rawText && !answer) {
        return null
      }

      const normalizedAnswer = answer ? normalizeSubmissionAnswer(answer) : '-'
      if (normalizedAnswer !== '-' && isImageUrl(normalizedAnswer)) {
        return {
          kind: 'image',
          alt: rawText ? `${rawText} submission` : 'Submission image',
          imageUrl: normalizedAnswer,
          label: rawText || 'Image',
          order,
        } satisfies NormalizedSubmissionRow
      }

      return {
        kind: 'field',
        answerText: normalizedAnswer || '-',
        label: rawText || 'Field',
        order,
      } satisfies NormalizedSubmissionRow
    })
    .filter(Boolean)
    .sort((a, b) => (a!.order ?? 0) - (b!.order ?? 0)) as NormalizedSubmissionRow[]
}

export function pickSubmissionDisplayName(rows: NormalizedSubmissionRow[]) {
  const fieldRows = rows.filter(
    (row): row is Extract<NormalizedSubmissionRow, { kind: 'field' }> => row.kind === 'field',
  )

  const scored = fieldRows
    .map(row => {
      const label = row.label.toLowerCase()
      let score = 0
      if (label === 'full name') score += 120
      if (label.includes('participant') && label.includes('name')) score += 100
      if (label.includes('client') && label.includes('name')) score += 95
      if (label === 'name') score += 80
      if (label.includes('first name')) score += 40
      if (label.includes('last name')) score += 35
      if (label.includes('insurance')) score -= 40
      if (label.includes('service')) score -= 20
      return { score, value: row.answerText }
    })
    .filter(item => item.score > 0 && item.value && item.value !== '-')
    .sort((a, b) => b.score - a.score)

  return scored[0]?.value || ''
}
