import { ArrowLeft, Ban, Eye, RefreshCw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { postJson } from '../lib/request'
import { STAFF_TOKEN_KEY, clearSessionFlag, getSessionFlag } from '../lib/storage'
import type { DeleteCodeResponse, ListCodesResponse, RevokeCodeResponse, StaffCodeRecord } from '../types/api'

interface AuditPageProps {
  onBack: () => void
}

const STATUS_OPTIONS = [
  { label: 'All statuses', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Used up', value: 'used_up' },
  { label: 'Expired', value: 'expired' },
  { label: 'Revoked', value: 'revoked' },
] as const

export function AuditPage({ onBack }: AuditPageProps) {
  const [codes, setCodes] = useState<StaffCodeRecord[]>([])
  const [feedback, setFeedback] = useState('')
  const [feedbackTone, setFeedbackTone] = useState<'error' | 'success'>('success')
  const [isLoading, setIsLoading] = useState(false)
  const [isDeletingId, setIsDeletingId] = useState('')
  const [isRevokingId, setIsRevokingId] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]['value']>('all')
  const staffToken = getSessionFlag(STAFF_TOKEN_KEY)
  const navigate = useNavigate()

  const loadCodes = useCallback(async () => {
    if (!staffToken) {
      setFeedbackTone('error')
      setFeedback('Staff session required. Open the staff drawer and log in first.')
      return
    }

    setIsLoading(true)
    setFeedback('')
    const result = await postJson<ListCodesResponse>(
      '/api/staff/list-codes',
      {},
      {
        headers: { Authorization: `Bearer ${staffToken}` },
        networkErrorMessage: 'Unable to load generated codes right now.',
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
      setFeedback(result.errorMessage || result.data?.error || 'Unable to load generated codes right now.')
      return
    }

    setCodes(result.data.codes || [])
    setIsLoading(false)
  }, [staffToken])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCodes()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadCodes])

  const filteredCodes = useMemo(() => {
    const query = search.trim().toLowerCase()

    return codes.filter(code => {
      const matchesStatus = statusFilter === 'all' || code.status === statusFilter
      const haystack = [
        code.code || '',
        code.clientRef || '',
        code.last4,
        code.status,
        code.id,
      ]
        .join(' ')
        .toLowerCase()

      const matchesSearch = !query || haystack.includes(query)
      return matchesStatus && matchesSearch
    })
  }, [codes, search, statusFilter])

  const handleRevoke = async (id: string) => {
    if (!staffToken) {
      return
    }

    setIsRevokingId(id)
    setFeedback('')
    const result = await postJson<RevokeCodeResponse>(
      '/api/staff/revoke-code',
      { id },
      {
        headers: { Authorization: `Bearer ${staffToken}` },
        networkErrorMessage: 'Unable to revoke this code right now.',
      },
    )

    if (!result.ok || !result.data?.ok) {
      if (result.status === 401) {
        clearSessionFlag(STAFF_TOKEN_KEY)
        setIsRevokingId('')
        setFeedbackTone('error')
        setFeedback('Staff session expired. Return to intake and log in again.')
        return
      }

      setIsRevokingId('')
      setFeedbackTone('error')
      setFeedback(result.errorMessage || result.data?.error || 'Unable to revoke this code right now.')
      return
    }

    setFeedbackTone('success')
    setFeedback('Code revoked.')
    setIsRevokingId('')
    void loadCodes()
  }

  const handleDelete = async (id: string) => {
    if (!staffToken) {
      return
    }

    setIsDeletingId(id)
    setFeedback('')
    const result = await postJson<DeleteCodeResponse>(
      '/api/staff/delete-code',
      { id },
      {
        headers: { Authorization: `Bearer ${staffToken}` },
        networkErrorMessage: 'Unable to delete this code right now.',
      },
    )

    if (!result.ok || !result.data?.ok) {
      if (result.status === 401) {
        clearSessionFlag(STAFF_TOKEN_KEY)
        setIsDeletingId('')
        setFeedbackTone('error')
        setFeedback('Staff session expired. Return to intake and log in again.')
        return
      }

      setIsDeletingId('')
      setFeedbackTone('error')
      setFeedback(result.errorMessage || result.data?.error || 'Unable to delete this code right now.')
      return
    }

    setFeedbackTone('success')
    setFeedback('Revoked code deleted from history.')
    setIsDeletingId('')
    void loadCodes()
  }

  return (
    <main className="audit-shell">
      <section className="surface-panel audit-header">
        <div>
          <div className="eyebrow">Staff audit</div>
          <h1>Generated intake codes</h1>
          <p>Search, filter, review usage, and revoke codes without exposing stored plaintext values.</p>
        </div>
        <div className="audit-header-actions">
          <button className="ghost-button" type="button" onClick={onBack}>
            <ArrowLeft size={16} />
            Back to intake
          </button>
          <button className="ghost-button" type="button" onClick={() => navigate('/submissions')}>
            <Eye size={16} />
            View submissions
          </button>
          <button className="secondary-button" type="button" onClick={() => void loadCodes()} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </section>

      <section className="surface-panel audit-filters">
        <label>
          Search
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search by client name, code, last4, id, or status"
          />
        </label>

        <label>
          Status filter
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)}>
            {STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {feedback ? <p className={feedbackTone === 'success' ? 'status-success' : 'status-error'}>{feedback}</p> : null}

      <section className="audit-grid">
        {filteredCodes.length ? (
          filteredCodes.map(code => (
            <article className="surface-panel audit-card" key={code.id}>
              <div className="audit-card-top">
                <div>
                  <div className="eyebrow">Client name</div>
                  <h3>{code.clientRef || 'Not provided'}</h3>
                </div>
                <span className={`status-pill status-${code.status}`}>{code.status.replace('_', ' ')}</span>
              </div>

              <div className="audit-meta-grid">
                  <div className="audit-meta-item full-span">
                    <strong>Generated code</strong>
                    <span>{code.code || 'Unavailable for legacy records created before encrypted storage was enabled.'}</span>
                  </div>
                <div className="audit-meta-item">
                  <strong>Last 4</strong>
                  <span>{code.last4}</span>
                </div>
                <div className="audit-meta-item">
                  <strong>Usage</strong>
                  <span className="usage-badge">{code.usedCount} / {code.maxUses}</span>
                </div>
                <div className="audit-meta-item">
                  <strong>Created</strong>
                  <span>{new Date(code.createdAt).toLocaleString()}</span>
                </div>
                <div className="audit-meta-item">
                  <strong>Expires</strong>
                  <span>{new Date(code.expiresAt).toLocaleString()}</span>
                </div>
                <div className="audit-meta-item full-span">
                  <strong>Record id</strong>
                  <span>{code.id}</span>
                </div>
              </div>

              <div className="audit-card-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => void handleRevoke(code.id)}
                  disabled={code.revoked || isRevokingId === code.id}
                >
                  <Ban size={16} />
                  {isRevokingId === code.id ? 'Revoking...' : code.revoked ? 'Already revoked' : 'Revoke'}
                </button>
                {code.revoked ? (
                  <button
                    className="ghost-button danger-button"
                    type="button"
                    onClick={() => void handleDelete(code.id)}
                    disabled={isDeletingId === code.id}
                  >
                    <Trash2 size={16} />
                    {isDeletingId === code.id ? 'Deleting...' : 'Delete history'}
                  </button>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <section className="surface-panel audit-empty">
            <h3>No matching code records</h3>
            <p>Try a different search term or status filter.</p>
          </section>
        )}
      </section>
    </main>
  )
}
