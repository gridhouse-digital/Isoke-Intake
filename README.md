# Isoke Intake

Private admissions / intake portal for `intake.isokedevelops.com`.

This app is a standalone Vite + React + TypeScript project with Vercel-style API routes. It is intentionally separate from the public marketing site and is meant to be shared directly with clients and staff.

## What It Does

- Client enters an access code to unlock the intake form
- Jotform iframe only renders while the page is currently unlocked
- Staff can open a protected drawer, log in, generate codes, and send intake emails
- Staff can open an audit page to review code status, usage, expiry, revoke codes, and delete revoked history
- Callback requests are handled through a modal and sent through the server

## Stack

- `Vite`
- `React`
- `TypeScript`
- `Tailwind CSS v4`
- `Supabase`
- `Resend`
- `Vercel-style API routes`

## Project Structure

```txt
api/
  staff/
  _lib/
docs/
src/
  components/
  pages/
  lib/
scripts/
```

## Local Development

Install dependencies:

```powershell
npm install
```

Run frontend only:

```powershell
npm run dev
```

Run local API only:

```powershell
npm run dev:api
```

Run frontend + local API together:

```powershell
npm run dev:full
```

## Verification

Typecheck:

```powershell
npm run typecheck
```

Lint:

```powershell
npm run lint
```

Tests:

```powershell
npm test
```

Production build:

```powershell
npm run build
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in real values.

Required app values:

```env
VITE_JOTFORM_EMBED_URL=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
STAFF_PASSWORD_HASH=
STAFF_SESSION_SIGNING_SECRET=
CODE_HASH_PEPPER=
CODE_ENCRYPTION_SECRET=

VERIFY_RATE_LIMIT_WINDOW_MS=600000
VERIFY_RATE_LIMIT_MAX=10

JOTFORM_API_KEY=
JOTFORM_FORM_ID=260746582455061

RESEND_API_KEY=
CALLBACK_EMAIL_TO=
CALLBACK_EMAIL_FROM=
CALLBACK_EMAIL_REPLY_TO=
CALLBACK_WEBHOOK_URL=
INTAKE_CODE_EMAIL_FROM=
INTAKE_CODE_EMAIL_REPLY_TO=
```

Notes:

- `SUPABASE_SERVICE_ROLE_KEY` must be the real server/service key, not the anon/publishable key
- `STAFF_PASSWORD_HASH` is the bcrypt hash of the real staff password
- `STAFF_SESSION_SIGNING_SECRET` signs staff JWT sessions
- `CODE_HASH_PEPPER` is used for deterministic code hashing
- `CODE_ENCRYPTION_SECRET` encrypts a staff-visible copy of newly generated codes for audit purposes

## Supabase Setup

Run:

```sql
-- Website/Isoke-Intake/docs/supabase.sql
```

This creates:

- `public.intake_codes`
- `public.intake_rate_limits`
- `public.verify_intake_code(input_hash text)`

Important:

- `intake_codes` is RLS-locked on purpose
- only server routes using the service role key should read/write it

## Access Codes

Format:

```txt
ISOKE-<LAST4>-<SUFFIX>
```

Example:

```txt
ISOKE-5313-K7M4Q9
```

Rules:

- plaintext code is returned once at creation time
- DB lookup uses `code_hash`
- audit visibility of plaintext codes only works for rows created after `code_ciphertext` support was added

## Staff Session Behavior

- staff login creates a JWT-based session
- session duration is currently `60 minutes`
- expired staff sessions should clear and force re-login
- staff being logged in can keep the intake form accessible

## Audit Page

The audit page is reachable from the staff drawer only.

It supports:

- search
- status filtering
- usage review
- revoke
- delete history for revoked codes

Important limitation:

- older records created before encrypted code storage was added will not show plaintext code in audit
- those rows will still show metadata like client name, status, usage, and expiry

## Deployment

Deploy this folder as its own Vercel project.

Recommended settings:

- Root directory: `Website/Isoke-Intake`
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`

Domain target:

```txt
intake.isokedevelops.com
```

## Operational Notes

- restart `npm run dev:full` after adding new API routes or changing server env vars
- if an API route returns `404` locally after you added it, you are usually still on an older `dev:api` process
- keep real secrets in `.env.local` and Vercel envs only
- do not store real values in `.env.example`
