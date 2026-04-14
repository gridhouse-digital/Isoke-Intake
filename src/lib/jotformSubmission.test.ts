import { describe, expect, it } from 'vitest'
import { normalizeJotformSubmissionRows, pickSubmissionDisplayName } from './jotformSubmission'

describe('normalizeJotformSubmissionRows', () => {
  it('hides structural page breaks and continue rows', () => {
    const answers = {
      one: { order: '1', text: 'Page Break' },
      two: { order: '2', text: 'Continue' },
      three: { order: '3', text: 'Full Name', answer: { first: 'Jane', last: 'Doe' } },
    }

    expect(normalizeJotformSubmissionRows(answers)).toEqual([
      {
        kind: 'field',
        answerText: 'Jane Doe',
        label: 'Full Name',
        order: 3,
      },
    ])
  })

  it('normalizes html that is stored in text into html blocks', () => {
    const answers = {
      one: {
        order: '1',
        text: '<p><strong>Agreement</strong></p><ul><li>One</li></ul>',
      },
    }

    expect(normalizeJotformSubmissionRows(answers)).toEqual([
      {
        kind: 'html_block',
        html: '<p><strong>Agreement</strong></p><ul><li>One</li></ul>',
        order: 1,
      },
    ])
  })

  it('promotes image urls into image rows', () => {
    const answers = {
      one: {
        order: '1',
        text: 'Signature',
        answer: 'https://example.com/signature.png',
      },
    }

    expect(normalizeJotformSubmissionRows(answers)).toEqual([
      {
        kind: 'image',
        alt: 'Signature submission',
        imageUrl: 'https://example.com/signature.png',
        label: 'Signature',
        order: 1,
      },
    ])
  })

  it('promotes jotform file objects into image rows using their hosted link', () => {
    const answers = {
      one: {
        order: '1',
        text: 'Signature',
        answer: {
          name: 'signature.png',
          link: 'https://www.jotform.com/uploads/example/1234567890/signature.png',
        },
      },
    }

    expect(normalizeJotformSubmissionRows(answers)).toEqual([
      {
        kind: 'image',
        alt: 'Signature submission',
        imageUrl: 'https://www.jotform.com/uploads/example/1234567890/signature.png',
        label: 'Signature',
        order: 1,
      },
    ])
  })

  it('classifies section-only headings separately from unanswered questions', () => {
    const answers = {
      one: { order: '1', text: 'Participant Information' },
      two: { order: '2', text: 'If yes, specify authorized recipients or organizations' },
    }

    expect(normalizeJotformSubmissionRows(answers)).toEqual([
      {
        kind: 'section',
        order: 1,
        title: 'Participant Information',
      },
      {
        kind: 'field',
        answerText: '-',
        label: 'If yes, specify authorized recipients or organizations',
        order: 2,
      },
    ])
  })
})

describe('pickSubmissionDisplayName', () => {
  it('picks the strongest field label match', () => {
    const rows = [
      { kind: 'section', order: 1, title: 'Participant Information' } as const,
      { kind: 'field', order: 2, label: 'Full Name', answerText: 'Jane Doe' } as const,
      { kind: 'field', order: 3, label: 'Insurance Provider', answerText: 'Acme Health' } as const,
    ]

    expect(pickSubmissionDisplayName(rows)).toBe('Jane Doe')
  })
})
