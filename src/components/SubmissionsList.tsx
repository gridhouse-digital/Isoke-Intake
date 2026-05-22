import { ArrowLeft, RefreshCw } from 'lucide-react'
import type { JotformSubmissionSummary } from '../types/api'

interface SubmissionsListProps {
  isLoading: boolean
  offset: number
  onBack: () => void
  onNext: () => void
  onPrev: () => void
  onQueryChange: (query: string) => void
  onRefresh: () => void
  onSelect: (id: string) => void
  query: string
  selectedId: string
  submissions: JotformSubmissionSummary[]
  total: number | null
}

function SkeletonRow() {
  return (
    <div className="submission-list-row submission-list-row--skeleton" aria-hidden="true">
      <div className="skeleton-line skeleton-line--name" />
      <div className="skeleton-line skeleton-line--meta" />
    </div>
  )
}

export function SubmissionsList({
  isLoading,
  offset,
  onBack,
  onNext,
  onPrev,
  onQueryChange,
  onRefresh,
  onSelect,
  query,
  selectedId,
  submissions,
  total,
}: SubmissionsListProps) {
  const pageStart = offset + 1
  const pageEnd = offset + submissions.length
  const showCount = !isLoading && total !== null && submissions.length > 0

  return (
    <section className="submissions-list-panel surface-panel">
      <img src="/isoke%20logo.png" alt="Isoke Developmental Services" className="site-logo site-logo--panel" />
      <button className="ghost-button" type="button" onClick={onBack}>
        <ArrowLeft size={16} />
        Back to audit
      </button>
      <div className="submissions-list-header">
        <div>
          <div className="eyebrow">Intake</div>
          <h1>Form submissions</h1>
          <p>Review submitted intake forms.</p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh submissions"
        >
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
        </button>
      </div>

      <label className="submissions-search-label">
        <span className="sr-only">Search</span>
        <input
          type="search"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder="Search by name or submission ID"
          className="submissions-search-input"
        />
      </label>

      {showCount ? (
        <p className="submissions-count">
          Showing {pageStart}–{pageEnd}{total ? ` of ${total}` : ''}
        </p>
      ) : null}

      <div className="history-list">
        {isLoading ? (
          Array.from({ length: 5 }, (_, i) => <SkeletonRow key={i} />)
        ) : submissions.length > 0 ? (
          submissions.map(item => {
            const isActive = item.id === selectedId
            const submittedAt = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''
            return (
              <button
                key={item.id}
                className={`submission-list-row submission-list-row--stacked${isActive ? ' is-active' : ''}`}
                type="button"
                onClick={() => onSelect(item.id)}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="submission-row-name">{item.title || '—'}</span>
                {submittedAt ? <span className="submission-row-meta">{submittedAt}</span> : null}
                {item.email ? <span className="submission-row-meta">{item.email}</span> : null}
              </button>
            )
          })
        ) : (
          <div className="history-empty">No submissions yet (or Jotform API not configured).</div>
        )}
      </div>

      <div className="submissions-pagination">
        <button
          className="ghost-button"
          type="button"
          onClick={onPrev}
          disabled={offset === 0 || isLoading}
        >
          ← Prev
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={onNext}
          disabled={(total !== null && offset + 25 >= total) || isLoading}
        >
          Next →
        </button>
      </div>
    </section>
  )
}
