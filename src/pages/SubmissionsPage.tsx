import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SubmissionDetail } from '../components/SubmissionDetail'
import { SubmissionsList } from '../components/SubmissionsList'
import { postJson } from '../lib/request'
import { STAFF_TOKEN_KEY, clearSessionFlag, getSessionFlag } from '../lib/storage'
import type { JotformSubmissionSummary, ListSubmissionsResponse } from '../types/api'

interface SubmissionsPageProps {
  onBack: () => void
}

export function SubmissionsPage({ onBack }: SubmissionsPageProps) {
  const { id: selectedId } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const staffToken = getSessionFlag(STAFF_TOKEN_KEY)

  const [submissions, setSubmissions] = useState<JotformSubmissionSummary[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [offset, setOffset] = useState(0)
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState('')

  const loadSubmissions = useCallback(async () => {
    if (!staffToken) {
      setFeedback('Staff session required. Open the staff drawer and log in first.')
      return
    }

    setIsLoading(true)
    setFeedback('')

    const result = await postJson<ListSubmissionsResponse>(
      '/api/staff/jotform/list-submissions',
      { limit: 25, offset, query },
      {
        headers: { Authorization: `Bearer ${staffToken}` },
        networkErrorMessage: 'Unable to load submissions right now.',
      },
    )

    if (!result.ok || !result.data?.ok) {
      if (result.status === 401) {
        clearSessionFlag(STAFF_TOKEN_KEY)
        setIsLoading(false)
        setFeedback('Staff session expired. Return to intake and log in again.')
        return
      }

      setIsLoading(false)
      setFeedback(result.errorMessage || result.data?.error || 'Unable to load submissions right now.')
      return
    }

    setSubmissions(result.data.submissions || [])
    setTotal(typeof result.data.total === 'number' ? result.data.total : null)
    setIsLoading(false)
  }, [offset, query, staffToken])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSubmissions()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadSubmissions])

  const handleSelect = (id: string) => {
    navigate(`/submissions/${id}`)
  }

  const handleBack = () => {
    navigate('/submissions')
  }

  const handleSessionExpired = () => {
    setFeedback('Staff session expired. Return to intake and log in again.')
    navigate('/submissions')
  }

  // On mobile (< 768px): show only list or only detail based on URL
  // On desktop: show both side by side
  const showDetail = Boolean(selectedId)

  return (
    <div className="submissions-shell">
      {feedback ? <p className="status-error submissions-feedback">{feedback}</p> : null}

      <div className={`submissions-layout${showDetail ? ' submissions-layout--detail-open' : ''}`}>
        <div className="submissions-list-col">
          <SubmissionsList
            isLoading={isLoading}
            offset={offset}
            onBack={onBack}
            onNext={() => setOffset(o => o + 25)}
            onPrev={() => setOffset(o => Math.max(o - 25, 0))}
            onQueryChange={q => { setQuery(q); setOffset(0) }}
            onRefresh={() => void loadSubmissions()}
            onSelect={handleSelect}
            query={query}
            selectedId={selectedId ?? ''}
            submissions={submissions}
            total={total}
          />
        </div>

        {showDetail && selectedId ? (
          <div className="submissions-detail-col">
            <SubmissionDetail
              onBack={handleBack}
              onSessionExpired={handleSessionExpired}
              staffToken={staffToken}
              submissionId={selectedId}
            />
          </div>
        ) : (
          <div className="submissions-detail-col submissions-detail-empty-state">
            <p>Select a submission to review it.</p>
          </div>
        )}
      </div>
    </div>
  )
}
