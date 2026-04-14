# Submissions Page Redesign

**Date:** 2026-04-14  
**Status:** Approved  
**Scope:** Refactor `SubmissionsPage` into a master/detail layout suited for deep intake review by staff.

---

## Background

The Submissions page is used by Isoke staff to do deep review of completed Jotform AI agent intake submissions. Clients are pre-approved before receiving an access code, so this page is purely a review tool — no approval/denial workflow is needed. The current slide-out drawer is too narrow for thorough reading of full intake documents. Staff work primarily on desktop but the page must be fully responsive.

---

## Routing

Two routes share the same `SubmissionsPage` shell:

- `/submissions` — list view; detail panel shows empty state
- `/submissions/:id` — list + detail; detail auto-loads the submission for `:id`

`App.tsx` gains a `/submissions/:id` route pointing to the same `SubmissionsPage` component. The component reads `id` from `useParams` and triggers a detail fetch when present.

Direct URL visits (bookmarks, shared links) must load the detail immediately without requiring a list interaction.

---

## Component Structure

`SubmissionsPage` is split into three focused components:

### `SubmissionsPage` (shell)
- Owns shared state: `submissions`, `total`, `offset`, `query`, `staffToken`, loading/feedback flags
- Composes `SubmissionsList` and `SubmissionDetail` side by side on desktop
- On mobile (< 768px): renders only `SubmissionsList` when no `:id` is selected; renders only `SubmissionDetail` when `:id` is present (with Back navigation)
- Reads `:id` from URL via `useParams`; when it changes, triggers detail fetch

### `SubmissionsList`
- Props: `submissions`, `total`, `offset`, `query`, `isLoading`, `selectedId`, callbacks for `onSelect`, `onQueryChange`, `onPrev`, `onNext`, `onRefresh`
- Renders search input, list rows, pagination footer, total count label
- No internal data fetching — purely presentational + event delegation

### `SubmissionDetail`
- Props: `submissionId`, `staffToken`, callback `onBack` (mobile only)
- Owns its own fetch lifecycle: fetches detail when `submissionId` changes
- Renders the document body from `normalizeJotformSubmissionRows` output
- Handles its own loading, error, and empty states

### `SubmissionImage` (unchanged)
- Stays as a sub-component inside `SubmissionDetail`

---

## List Panel

**Layout:** Fixed width ~320px on desktop, full-width on mobile.

**Row content (stacked, not horizontal):**
- Line 1: client name / submission title (bold)
- Line 2: submitted date (muted, small)
- Line 3: email if present (muted, small) — omitted if absent

**Active state:** Selected row gets a background highlight and a left border accent.

**Header:** Title ("Form submissions") + Refresh button only. No pagination in the header.

**Above list:** "Showing 1–25 of 47" count label (hidden while loading).

**Pagination:** Prev / Next at the bottom of the panel.

**Loading state:** 5 skeleton placeholder rows while fetching.

**Search placeholder:** "Search by name or submission ID" (replacing the current verbose placeholder).

---

## Detail Panel

**Header:**
- `<h2>` — client name from `pickSubmissionDisplayName`, fallback to submission ID
- Muted line: submission ID
- Muted line: submitted date (formatted locale string)
- Refresh button (top-right)

**Document body** — rendered from `normalizeJotformSubmissionRows` output:

| Row kind | Rendering |
|---|---|
| `section` | Bold section heading with a divider rule above |
| `field` | Label in muted small text, answer stacked below in normal weight |
| `html_block` | Rendered via `dangerouslySetInnerHTML` (existing DOMPurify sanitization) |
| `image` | Full-width inline image, wrapped in a link to open full-size |

**Loading state:** Skeleton placeholder for the document body.

**Error state:** Inline error message with a Retry button.

**Empty answers:** "No answers found for this submission." with a Refresh button.

**Mobile:** Full-screen with a "← Back to submissions" link at the top (navigates to `/submissions`).

**Desktop empty state** (no submission selected): Centered placeholder — "Select a submission to review it."

---

## Copy Corrections

| Location | Current | Updated |
|---|---|---|
| Page `<h1>` | "Form submissions" | "Form submissions" (keep) |
| Page `<p>` description | "Review workflow status and apply an internal approve/deny decision for intake processing." | "Review submitted intake forms." |

---

## Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| ≥ 768px (desktop) | Two-column layout: list panel left (~320px), detail fills remaining width |
| < 768px (mobile) | Single column: list OR detail visible at a time, navigated via URL |

---

## What Does Not Change

- API routes (`/api/staff/jotform/list-submissions`, `/api/staff/jotform/get-submission`, `/api/staff/jotform/file`) — no changes
- `normalizeJotformSubmissionRows` and `pickSubmissionDisplayName` — no changes
- `SubmissionImage` component — no changes
- Auth pattern (staff token from `sessionStorage`, 401 → clear + error message) — no changes
- Pagination size (25 per page) — no changes
