# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite frontend only (port 5173)
npm run dev:api      # Local API server only (port 3001)
npm run dev:full     # Frontend + API together (use this for full local dev)
npm run build        # Production build
npm run typecheck    # TypeScript type checking (runs tsc --build)
npm run lint         # ESLint
npm test             # Vitest (run once, no watch)
```

Restart `dev:full` after adding new API routes or changing server env vars — the API server does not hot-reload.

To run a single test file:
```bash
node node_modules/vitest/vitest.mjs run src/lib/jotformSubmission.test.ts
```

## Architecture

This is a Vite + React + TypeScript SPA deployed on Vercel, with Vercel-style API routes. The frontend and API share the same repo but run as separate processes locally.

### Frontend (`src/`)

- **`App.tsx`** — root router. Three routes: `/` (`IntakeHome`), `/audit` (`AuditPage`), `/submissions` (`SubmissionsPage`).
- **`components/`** — UI components used in `IntakeHome`:
  - `AccessGate` — code entry form that calls `/api/verify-code`
  - `JotformFrame` — renders the Jotform iframe only when unlocked
  - `StaffTools` — staff drawer (login, code generation, email sending, audit nav)
  - `CallbackForm` — modal callback request form
  - `SupportCard` — static support contact info
- **`pages/`** — full-page views:
  - `AuditPage` — code management (search, filter, revoke, delete)
  - `SubmissionsPage` — Jotform submission viewer
- **`lib/`** — client utilities:
  - `request.ts` — typed `postJson()` wrapper around `fetch`
  - `storage.ts` — `sessionStorage` helpers for `intakeUnlocked` and `staffToken` keys
  - `jotformSubmission.ts` — normalizes raw Jotform answer payloads into typed display rows
  - `jotformRichText.ts` — sanitizes and extracts HTML from Jotform rich text fields
  - `content.ts` — static copy/strings
  - `useDocumentMeta.ts` — sets `<title>`, meta description, and canonical

### API (`api/`)

Each file exports a single `POST(request: Request): Promise<Response>` function — Vercel edge function signature. No Express, no framework.

- **`verify-code.ts`** — validates an access code. Hashes input with SHA-256 + pepper, calls `verify_intake_code` RPC, enforces IP rate limiting.
- **`callback.ts`** — sends callback request email via Resend and optionally POSTs to a webhook.
- **`staff/login.ts`** — bcrypt-compares password against `STAFF_PASSWORD_HASH`, issues a 60-minute JWT signed with `STAFF_SESSION_SIGNING_SECRET`.
- **`staff/session.ts`** — validates a staff JWT, returns `{ ok: true }` or `{ ok: false }`.
- **`staff/create-code.ts`** — generates `ISOKE-<LAST4>-<SUFFIX>` code, stores hash + AES-256-GCM ciphertext in Supabase.
- **`staff/list-codes.ts`** — returns all intake codes for the audit page.
- **`staff/revoke-code.ts`** / **`delete-code.ts`** — mutate code status in Supabase.
- **`staff/send-code-email.ts`** — sends intake code email via Resend.
- **`staff/jotform/`** — proxies Jotform API calls (list submissions, get submission, fetch file).

### Shared API internals (`api/_lib/`)

- **`intake.ts`** — code generation, hashing (`SHA-256 + pepper`), AES-256-GCM encryption/decryption, and other pure utilities.
- **`supabase.ts`** — creates a singleton `@supabase/supabase-js` admin client using the service role key.
- **`rate-limit.ts`** — IP + scope rate limiting backed by the `intake_rate_limits` Supabase table.
- **`staff-session.ts`** — JWT sign/verify using `jose` and `STAFF_SESSION_SIGNING_SECRET`.
- **`callback-email-template.ts`** — HTML email template for callback requests.

### Local dev server (`scripts/dev-api.ts`)

A plain Node.js HTTP server that loads `.env` / `.env.local`, maps URL paths to the same `POST` handler exports, and proxies requests. Vite is configured to proxy `/api/*` to `http://localhost:3001`.

## Key Constraints

- All staff API routes must verify the JWT from the `Authorization: Bearer <token>` header using `api/_lib/staff-session.ts` before acting.
- The Supabase `intake_codes` table is RLS-locked — only the service role key (never the anon key) can read/write it.
- Access codes are never stored in plaintext. The DB stores `code_hash` (SHA-256 + pepper) for verification and `code_ciphertext` (AES-256-GCM) for staff audit visibility. Plaintext is returned once at creation only.
- The Jotform iframe renders only while the user is unlocked (`isUnlocked || hasStaffAccess`). Unlock state is kept in `sessionStorage` — it clears on tab close.
- `VITE_*` env vars are the only ones accessible in frontend code. All secrets must stay in API routes only.

## Environment

Copy `.env.example` to `.env.local`. The local API server reads `.env.local` at startup via `scripts/dev-api.ts`. Vite reads `VITE_*` vars automatically. After changing env vars, restart `dev:full`.

## Deployment

Deploy as a standalone Vercel project with:
- Root directory: `Website/Isoke-Intake`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

`vercel.json` rewrites all non-`/api/` paths to `/index.html` for SPA routing.
