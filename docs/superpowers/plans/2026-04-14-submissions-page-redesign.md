# Submissions Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `SubmissionsPage` from a narrow slide-out drawer into a two-column master/detail layout with a dedicated detail route, suited for deep intake document review.

**Architecture:** Split the existing `SubmissionsPage` monolith into three components — `SubmissionsPage` (shell/router), `SubmissionsList` (left panel, presentational), and `SubmissionDetail` (right panel, owns its own fetch). Add a `/submissions/:id` route. On desktop both panels show side-by-side; on mobile the URL determines which panel is visible. All existing API routes, utilities, and auth patterns remain unchanged.

**Tech Stack:** React 19, React Router v7, TypeScript, Tailwind CSS v4 (custom CSS classes in `src/index.css`), Vitest + Testing Library

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/App.tsx` | Add `/submissions/:id` route |
| Create | `src/pages/SubmissionsPage.tsx` | Replace existing file — shell component, owns list data fetching |
| Create | `src/components/SubmissionsList.tsx` | New — presentational list panel |
| Create | `src/components/SubmissionDetail.tsx` | New — owns detail fetch, renders document body |
| Modify | `src/index.css` | Add new layout classes, remove old drawer classes |

`SubmissionImage` moves from `SubmissionsPage.tsx` into `SubmissionDetail.tsx` (it was already only used there).

---

## Task 1: Add `/submissions/:id` route to App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the parameterised route**

In `src/App.tsx`, update `AppRoutes` to add the `:id` route. The same `SubmissionsPage` component handles both:

```tsx
function AppRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/" element={<IntakeHome />} />
      <Route path="/audit" element={<AuditPage onBack={() => navigate('/')} />} />
      <Route path="/submissions" element={<SubmissionsPage onBack={() => navigate('/audit')} />} />
      <Route path="/submissions/:id" element={<SubmissionsPage onBack={() => navigate('/audit')} />} />
      <Route path="*" element={<IntakeHome />} />
    </Routes>
  )
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /submissions/:id route"
```

---

## Task 2: Create `SubmissionsList` component

**Files:**
- Create: `src/components/SubmissionsList.tsx`
- Test: `src/lib/request.test.ts` (no new tests needed — this is pure presentational)

- [ ] **Step 1: Create the component file**

Create `src/components/SubmissionsList.tsx`:

```tsx
import { RefreshCw } from 'lucide-react'
import type { JotformSubmissionSummary } from '../types/api'

interface SubmissionsListProps {
  isLoading: boolean
  offset: number
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
```

- [ ] **Step 2: Verify type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SubmissionsList.tsx
git commit -m "feat: add SubmissionsList component"
```

---

## Task 3: Create `SubmissionDetail` component

**Files:**
- Create: `src/components/SubmissionDetail.tsx`

- [ ] **Step 1: Create the component file**

Create `src/components/SubmissionDetail.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/SubmissionDetail.tsx
git commit -m "feat: add SubmissionDetail component"
```

---

## Task 4: Rewrite `SubmissionsPage` shell

**Files:**
- Modify: `src/pages/SubmissionsPage.tsx`

- [ ] **Step 1: Replace the file contents**

Overwrite `src/pages/SubmissionsPage.tsx` with:

```tsx
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
```

- [ ] **Step 2: Verify type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Verify tests pass**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SubmissionsPage.tsx
git commit -m "feat: rewrite SubmissionsPage as master/detail shell"
```

---

## Task 5: Add CSS for new layout

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add new layout and component classes**

At the end of `src/index.css`, before the closing `@media` blocks, add the following CSS. Insert it just before the `@media (max-width: 960px)` block:

```css
/* ── Submissions page layout ──────────────────────────────── */

.submissions-shell {
  width: min(1400px, calc(100% - 32px));
  margin: 0 auto;
  padding: 28px 0 56px;
  display: grid;
  gap: 18px;
}

.submissions-feedback {
  margin: 0;
}

.submissions-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  align-items: start;
}

.submissions-list-col {
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

.submissions-detail-col {
  min-height: 400px;
}

.submissions-detail-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  border: 1px dashed var(--border);
  border-radius: 28px;
  padding: 40px;
}

/* List panel */

.submissions-list-panel {
  display: grid;
  gap: 16px;
}

.submissions-list-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
}

.submissions-list-header h1 {
  margin: 6px 0 4px;
  font-size: 1.4rem;
}

.submissions-list-header p {
  margin: 0;
  color: var(--muted);
  font-size: 0.875rem;
}

.submissions-search-label {
  display: block;
}

.submissions-search-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.7);
  color: var(--ink);
  outline: none;
}

.submissions-search-input:focus {
  border-color: var(--violet);
}

.submissions-count {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}

.submissions-pagination {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--border);
}

/* List rows (stacked layout) */

.submission-list-row--stacked {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3px;
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(123, 94, 167, 0.1);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background 120ms ease, border-color 120ms ease;
}

.submission-list-row--stacked:hover {
  background: rgba(255, 255, 255, 0.88);
  border-color: rgba(123, 94, 167, 0.22);
}

.submission-list-row--stacked.is-active {
  border-color: var(--violet);
  border-left-width: 3px;
  background: rgba(123, 94, 167, 0.06);
}

.submission-row-name {
  font-weight: 700;
  color: var(--violet-deep);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.submission-row-meta {
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Skeleton loading */

.submission-list-row--skeleton {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(123, 94, 167, 0.06);
  pointer-events: none;
}

.skeleton-line {
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(123, 94, 167, 0.08) 25%, rgba(123, 94, 167, 0.15) 50%, rgba(123, 94, 167, 0.08) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease infinite;
  height: 14px;
}

.skeleton-line--name {
  width: 70%;
  height: 16px;
}

.skeleton-line--meta {
  width: 45%;
}

.skeleton-line--title {
  width: 55%;
  height: 28px;
}

.skeleton-line--field {
  width: 100%;
  height: 56px;
  border-radius: 16px;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Detail panel */

.submission-detail-panel {
  display: grid;
  gap: 20px;
}

.submission-detail-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: start;
}

.submission-detail-header-left {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.submission-detail-title {
  margin: 0;
  font-size: clamp(1.2rem, 2.5vw, 1.6rem);
  color: var(--violet-deep);
  word-break: break-word;
}

.submission-detail-meta {
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted);
  word-break: break-all;
}

.submission-section-rule {
  border: none;
  border-top: 1px solid var(--border);
  margin: 6px 0 10px;
}

.submission-field-label {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 4px;
}

.submission-detail-error {
  display: grid;
  gap: 10px;
}

.submission-detail-skeleton {
  display: grid;
  gap: 12px;
}

.submission-detail-empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  color: var(--muted);
}
```

- [ ] **Step 2: Add responsive overrides inside the existing `@media (max-width: 640px)` block**

At the end of the `@media (max-width: 640px)` block (just before its closing `}`), add:

```css
  .submissions-shell {
    width: min(100% - 20px, 1400px);
    padding-top: 18px;
  }

  .submissions-layout {
    grid-template-columns: 1fr;
  }

  /* On mobile, hide the list when a detail is open */
  .submissions-layout--detail-open .submissions-list-col {
    display: none;
  }

  /* On mobile, hide the detail column when no submission is selected */
  .submissions-layout:not(.submissions-layout--detail-open) .submissions-detail-col {
    display: none;
  }

  .submissions-list-col {
    position: static;
    max-height: none;
    overflow: visible;
  }
```

- [ ] **Step 3: Remove now-unused drawer CSS**

Remove the following CSS blocks from `src/index.css` (they are replaced by the new layout):

- `.submission-drawer-backdrop` and `.submission-drawer-backdrop.is-open`
- `.submission-drawer` and `.submission-drawer.is-open`
- `.submission-drawer-header`
- `.submission-drawer-body`
- The `.submission-drawer` block inside `@media (max-width: 640px)`

Also remove the old horizontal `.submission-list-row` grid rule and `.submission-list-cell`, `.submission-name`, `.submission-date`, `.submission-email` classes — they are replaced by `.submission-list-row--stacked` and its children.

- [ ] **Step 4: Verify no TypeScript errors and tests pass**

```bash
npm run typecheck && npm test
```

Expected: no errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat: add submissions master/detail CSS, remove drawer styles"
```

---

## Task 6: Smoke-test the full feature locally

- [ ] **Step 1: Start the full dev environment**

```bash
npm run dev:full
```

Open `http://localhost:5173` in a browser. Log in via the staff drawer.

- [ ] **Step 2: Navigate to `/submissions`**

Verify:
- List panel renders on the left (~320px)
- Skeleton rows appear while loading
- Count label shows after load ("Showing 1–25 of N")
- Right panel shows "Select a submission to review it."

- [ ] **Step 3: Select a submission**

Verify:
- URL changes to `/submissions/:id`
- Detail panel renders on the right
- Skeleton shows while loading, then answers appear
- Section headings have a rule above them
- Field labels are small/muted, answers are below (not side-by-side)
- Images render inline

- [ ] **Step 4: Test direct URL load**

Paste a `/submissions/:id` URL directly into the browser address bar.

Verify:
- Detail auto-loads without needing to click a list item
- List still loads alongside it

- [ ] **Step 5: Test mobile layout**

Open DevTools, set viewport to 375px wide.

Verify:
- Only the list is visible at `/submissions`
- Selecting a submission shows only the detail panel
- "← Back to submissions" button navigates back to the list

- [ ] **Step 6: Commit if any minor fixes were needed**

```bash
git add -p
git commit -m "fix: smoke-test corrections for submissions page"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Two routes (`/submissions`, `/submissions/:id`) — Task 1
- ✅ `SubmissionsPage` shell owns list fetching — Task 4
- ✅ `SubmissionsList` presentational, stacked rows, skeleton, count, pagination at bottom — Task 2
- ✅ `SubmissionDetail` owns fetch lifecycle, document body, loading/error/empty states, `onBack` — Task 3
- ✅ Active state: left border + background — Task 5 CSS `.submission-list-row--stacked.is-active`
- ✅ Copy correction: "Review submitted intake forms." — Task 2 `SubmissionsList` JSX
- ✅ Auto-load on direct URL — Task 4, `useParams` + `useEffect` on `fetchDetail`
- ✅ Desktop two-column layout — Task 5 `.submissions-layout`
- ✅ Mobile single-column with hide/show — Task 5 `@media (max-width: 640px)`
- ✅ `SubmissionImage` moved into `SubmissionDetail` — Task 3
- ✅ Old drawer CSS removed — Task 5

**No placeholders, no ambiguous steps, types consistent across all tasks.**
