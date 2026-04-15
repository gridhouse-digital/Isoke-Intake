import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeJotformSubmissionRows, pickSubmissionDisplayName } from '../lib/jotformSubmission'
import { postJson } from '../lib/request'
import { STAFF_TOKEN_KEY, clearSessionFlag } from '../lib/storage'
import type { GetSubmissionResponse, JotformSubmissionDetail } from '../types/api'

interface SubmissionDetailProps {
  onBack?: () => void
  onSessionExpired: () => void
  staffToken: string
  submissionId: string
}

interface SubmissionImageProps {
  alt: string
  imageUrl: string
  label: string
  staffToken: string
}

function SubmissionImage({ alt, imageUrl, label, staffToken }: SubmissionImageProps) {
  const [blobUrl, setBlobUrl] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isActive = true
    let objectUrl = ''

    async function loadImage() {
      try {
        setLoadError('')
        setBlobUrl('')

        const response = await fetch('/api/staff/jotform/file', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${staffToken}`,
          },
          body: JSON.stringify({ url: imageUrl }),
        })

        if (!response.ok) {
          throw new Error('Image request failed')
        }

        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)

        if (!isActive) {
          URL.revokeObjectURL(objectUrl)
          return
        }

        setBlobUrl(objectUrl)
      } catch {
        if (isActive) {
          setLoadError('Unable to load this image.')
        }
      }
    }

    void loadImage()

    return () => {
      isActive = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [imageUrl, staffToken])

  if (blobUrl) {
    return (
      <a
        className="submission-image-link"
        href={blobUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${label}`}
      >
        <img className="submission-image" src={blobUrl} alt={alt} loading="lazy" />
      </a>
    )
  }

  return <span>{loadError || 'Loading image...'}</span>
}

export function SubmissionDetail({ onBack, onSessionExpired, staffToken, submissionId }: SubmissionDetailProps) {
  const [detail, setDetail] = useState<JotformSubmissionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchDetail = useCallback(async () => {
    if (!staffToken || !submissionId) return

    setIsLoading(true)
    setError('')

    const result = await postJson<GetSubmissionResponse>(
      '/api/staff/jotform/get-submission',
      { submissionId },
      {
        headers: { Authorization: `Bearer ${staffToken}` },
        networkErrorMessage: 'Unable to load this submission right now.',
      },
    )

    setIsLoading(false)

    if (result.status === 401) {
      clearSessionFlag(STAFF_TOKEN_KEY)
      onSessionExpired()
      return
    }

    if (!result.ok || !result.data?.ok || !result.data.submission) {
      setError(result.errorMessage || result.data?.error || 'Unable to load this submission right now.')
      return
    }

    setDetail(result.data.submission)
  }, [onSessionExpired, staffToken, submissionId])

  useEffect(() => {
    setDetail(null)
    void fetchDetail()
  }, [fetchDetail, submissionId])

  const answerRows = useMemo(() => normalizeJotformSubmissionRows(detail?.answers), [detail?.answers])
  const displayName = pickSubmissionDisplayName(answerRows) || detail?.title || submissionId
  const submittedAt = detail?.createdAt ? new Date(detail.createdAt).toLocaleString() : ''

  return (
    <section className="submission-detail-panel surface-panel">
      <div className="submission-detail-header">
        <div className="submission-detail-header-left">
          {onBack ? (
            <button className="ghost-button" type="button" onClick={onBack}>
              ← Back to submissions
            </button>
          ) : null}
          {isLoading ? (
            <div className="skeleton-line skeleton-line--title" aria-label="Loading..." />
          ) : (
            <h2 className="submission-detail-title">{displayName}</h2>
          )}
          <p className="submission-detail-meta">{submissionId}</p>
          {submittedAt ? <p className="submission-detail-meta">{submittedAt}</p> : null}
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void fetchDetail()}
          disabled={isLoading}
          aria-label="Refresh submission"
        >
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
        </button>
      </div>

      {error ? (
        <div className="submission-detail-error">
          <p className="status-error">{error}</p>
          <button className="ghost-button" type="button" onClick={() => void fetchDetail()}>
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="submission-detail-skeleton" aria-label="Loading submission...">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton-line skeleton-line--field" />
          ))}
        </div>
      ) : answerRows.length > 0 ? (
        <div className="submission-answer-grid">
          {answerRows.map(row => {
            const key =
              row.kind === 'section'
                ? `${row.order}-${row.title}`
                : row.kind === 'html_block'
                  ? `${row.order}-html`
                  : `${row.order}-${row.label}`

            return (
              <div
                className={`submission-answer-row${
                  row.kind === 'html_block' ? ' submission-answer-row-html-block' : ''
                }${row.kind === 'section' ? ' submission-answer-row-section' : ''}`}
                key={key}
              >
                {row.kind === 'section' ? (
                  <>
                    <hr className="submission-section-rule" />
                    <h4 className="submission-section-title">{row.title}</h4>
                  </>
                ) : null}
                {row.kind === 'field' ? (
                  <>
                    <strong className="submission-field-label">{row.label}</strong>
                    <span>{row.answerText}</span>
                  </>
                ) : null}
                {row.kind === 'image' ? (
                  <>
                    <strong className="submission-field-label">{row.label}</strong>
                    <SubmissionImage
                      alt={row.alt}
                      imageUrl={row.imageUrl}
                      label={row.label}
                      staffToken={staffToken}
                    />
                  </>
                ) : null}
                {row.kind === 'html_block' ? (
                  <div
                    className="submission-html"
                    dangerouslySetInnerHTML={{ __html: row.html }}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="submission-detail-empty">
          <p>No answers found for this submission.</p>
          <button className="ghost-button" type="button" onClick={() => void fetchDetail()}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      )}
    </section>
  )
}
