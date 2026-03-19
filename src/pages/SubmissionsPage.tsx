import { ArrowLeft, ChevronRight, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeJotformSubmissionRows, pickSubmissionDisplayName } from '../lib/jotformSubmission'
import { postJson } from '../lib/request'
import { STAFF_TOKEN_KEY, clearSessionFlag, getSessionFlag } from '../lib/storage'
import type { GetSubmissionResponse, JotformSubmissionDetail, JotformSubmissionSummary, ListSubmissionsResponse } from '../types/api'

interface SubmissionsPageProps {
  onBack: () => void
}

export function SubmissionsPage({ onBack }: SubmissionsPageProps) {
  const staffToken = getSessionFlag(STAFF_TOKEN_KEY)
  const [submissions, setSubmissions] = useState<JotformSubmissionSummary[]>([])
  const [selected, setSelected] = useState<JotformSubmissionDetail | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [feedback, setFeedback] = useState('')
  const [feedbackTone, setFeedbackTone] = useState<'error' | 'success'>('success')
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshingDetail, setIsRefreshingDetail] = useState(false)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState<number | null>(null)
  const [query, setQuery] = useState('')

  const loadSubmissions = useCallback(async () => {
    if (!staffToken) {
      setFeedbackTone('error')
      setFeedback('Staff session required. Open the staff drawer and log in first.')
      return
    }

    setIsLoading(true)
    setFeedback('')

    const result = await postJson<ListSubmissionsResponse>(
      '/api/staff/jotform/list-submissions',
      {
        limit: 25,
        offset,
        query,
      },
      {
        headers: { Authorization: `Bearer ${staffToken}` },
        networkErrorMessage: 'Unable to load submissions right now.',
      },
    )

    if (!result.ok || !result.data?.ok) {
      if (result.status === 401) {
        clearSessionFlag(STAFF_TOKEN_KEY)
        setIsLoading(false)
        setFeedbackTone('error')
        setFeedback('Staff session expired. Return to intake and log in again.')
        return
      }

      setIsLoading(false)
      setFeedbackTone('error')
      setFeedback(result.errorMessage || result.data?.error || 'Unable to load submissions right now.')
      return
    }

    setSubmissions(result.data.submissions || [])
    setTotal(typeof result.data.total === 'number' ? result.data.total : null)
    setIsLoading(false)
  }, [offset, query, staffToken])

  const loadSubmissionDetail = useCallback(async (submissionId: string, { refresh = false } = {}) => {
    if (!staffToken) {
      return
    }

    if (refresh) {
      setIsRefreshingDetail(true)
    }

    const result = await postJson<GetSubmissionResponse>(
      '/api/staff/jotform/get-submission',
      { submissionId },
      {
        headers: { Authorization: `Bearer ${staffToken}` },
        networkErrorMessage: 'Unable to load this submission right now.',
      },
    )

    if (!result.ok || !result.data?.ok || !result.data.submission) {
      if (result.status === 401) {
        clearSessionFlag(STAFF_TOKEN_KEY)
        setFeedbackTone('error')
        setFeedback('Staff session expired. Return to intake and log in again.')
      } else {
        setFeedbackTone('error')
        setFeedback(result.errorMessage || result.data?.error || 'Unable to load this submission right now.')
      }

      setIsRefreshingDetail(false)
      return
    }

    setSelected(result.data.submission)
    setIsRefreshingDetail(false)
  }, [staffToken])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSubmissions()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadSubmissions])

  const filteredSubmissions = submissions
  const selectedSummary = useMemo(() => submissions.find(item => item.id === selectedId) || null, [selectedId, submissions])

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setSelected(null)
    setFeedback('')
    void loadSubmissionDetail(id)
  }

  const canGoPrev = offset > 0 && !isLoading
  const canGoNext = (!total || offset + 25 < total) && !isLoading
  const answerRows = useMemo(() => normalizeJotformSubmissionRows(selected?.answers), [selected?.answers])
  const drawerTitle = selectedSummary?.title || pickSubmissionDisplayName(answerRows) || selectedId

  return (
    <main className="audit-shell">
      <section className="surface-panel audit-header">
        <div>
          <div className="eyebrow">Intake</div>
          <h1>Form submissions</h1>
          <p>Review workflow status and apply an internal approve/deny decision for intake processing.</p>
        </div>
        <div className="audit-header-actions">
          <button className="ghost-button" type="button" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to audit
          </button>
          <button className="secondary-button" type="button" onClick={() => void loadSubmissions()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="ghost-button" type="button" onClick={() => setOffset(Math.max(offset - 25, 0))} disabled={!canGoPrev}>
            Prev
          </button>
          <button className="ghost-button" type="button" onClick={() => setOffset(offset + 25)} disabled={!canGoNext}>
            Next
          </button>
        </div>
      </section>

      <section className="surface-panel audit-filters">
        <label>
          Search
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by submission id, workflow status, or a name-like field"
          />
        </label>
      </section>

      {feedback ? <p className={feedbackTone === 'success' ? 'status-success' : 'status-error'}>{feedback}</p> : null}

      <section className="audit-grid">
        <section className="surface-panel audit-card">
          <div className="audit-card-top">
            <div>
              <div className="eyebrow">Submissions</div>
              <h3>{filteredSubmissions.length ? `Showing ${filteredSubmissions.length}` : 'No submissions loaded yet'}</h3>
            </div>
          </div>

          <div className="history-list">
            {filteredSubmissions.length ? (
              filteredSubmissions.map(item => {
                const isActive = item.id === selectedId
                const submittedAt = item.createdAt ? new Date(item.createdAt).toLocaleString() : ''
                return (
                  <div className={`submission-list-row${isActive ? ' is-active' : ''}`} key={item.id}>
                    <div className="submission-list-cell submission-name" title={item.title || ''}>
                      {item.title || '-'}
                    </div>
                    <div className="submission-list-cell submission-email" title={item.email || ''}>
                      {item.email || '-'}
                    </div>
                    <div className="submission-list-cell submission-date" title={submittedAt}>
                      {submittedAt || '-'}
                    </div>
                    <button className="icon-button" type="button" onClick={() => handleSelect(item.id)} aria-label="Open submission">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )
              })
            ) : (
              <div className="history-empty">No submissions yet (or Jotform API not configured).</div>
            )}
          </div>
        </section>
      </section>

      <div
        className={`submission-drawer-backdrop${selectedId ? ' is-open' : ''}`}
        onClick={() => {
          setSelectedId('')
          setSelected(null)
        }}
      />

      <aside className={`submission-drawer${selectedId ? ' is-open' : ''}`} aria-hidden={!selectedId}>
        <section className="surface-panel staff-panel">
          <div className="submission-drawer-header">
            <div>
              <div className="eyebrow">Submission</div>
              <h3>{drawerTitle || 'Submission detail'}</h3>
              {selectedId ? <p style={{ color: 'var(--muted)' }}>{selectedId}</p> : null}
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setSelectedId('')
                setSelected(null)
              }}
              aria-label="Close submission"
            >
              <X size={16} />
            </button>
          </div>

          {selectedId ? (
            <div className="submission-drawer-body">
              <div className="audit-meta-grid">
                <div className="audit-meta-item full-span">
                  <strong>Created</strong>
                  <span>{selected?.createdAt ? new Date(selected.createdAt).toLocaleString() : 'Loading...'}</span>
                </div>
              </div>

              <div className="audit-card-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => void loadSubmissionDetail(selectedId, { refresh: true })}
                  disabled={isRefreshingDetail}
                >
                  <RefreshCw size={16} className={isRefreshingDetail ? 'spin' : ''} />
                  {isRefreshingDetail ? 'Refreshing...' : 'Refresh detail'}
                </button>
              </div>

              <div className="generated-panel">
                <div className="eyebrow">Answers</div>
                <h3>Submitted fields</h3>
                {answerRows.length ? (
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
                          {row.kind === 'section' ? <h4 className="submission-section-title">{row.title}</h4> : null}
                          {row.kind === 'field' ? <strong>{row.label}</strong> : null}
                          {row.kind === 'image' ? <strong>{row.label}</strong> : null}
                          {row.kind === 'html_block' ? (
                            <div
                              className="submission-html"
                              dangerouslySetInnerHTML={{
                                __html: row.html,
                              }}
                            />
                          ) : row.kind === 'image' ? (
                            <a
                              className="submission-image-link"
                              href={row.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                className="submission-image"
                                src={row.imageUrl}
                                alt={row.alt}
                                loading="lazy"
                              />
                            </a>
                          ) : row.kind === 'field' ? <span>{row.answerText}</span> : null}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p>Click "Refresh detail" to load the submitted fields.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="audit-empty">
              <p>Select a submission to view it.</p>
            </div>
          )}
        </section>
      </aside>
    </main>
  )
}
