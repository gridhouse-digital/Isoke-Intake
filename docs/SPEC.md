## Isoke Intake Module — Implementation Spec

### Summary
- **Goal**: Deploy a separate intake experience on `intake.isokedevelops.com` that is *only shared with clients* (not linked from the marketing site), gated by a **client-specific access code**, and embedding the **Jotform admissions packet**.
- **Staff workflow**: Staff can unlock a **password-gated staff tool** on the same page to generate access codes that include the client’s **phone last-4**.
- **System of record for submissions**: **Jotform** (not the website DB). The DB only stores access codes and their usage metadata.

### Non-goals (v1)
- No client accounts/login
- No staff accounts/roles (single shared staff password gate)
- No storing intake submissions in Supabase (handled by Jotform)
- No client PII personalization on the intake page

---

## User Experience

### Public (Client) Flow
1. Client opens `https://intake.isokedevelops.com`
2. Client sees:
   - Page title + short instructions
   - **Access code input**
   - Support numbers (after-hours + emergency after-hours)
3. Client enters code in the format `ISOKE-<LAST4>-<SUFFIX>`
4. App calls `POST /api/verify-code`
5. If valid:
   - App stores unlock state in `sessionStorage`
   - Jotform embed renders
6. If invalid/expired/revoked/used-up:
   - App shows a friendly error and “Request a callback” option

### Staff Flow (Same Page)
1. Staff clicks “Staff tools”
2. Staff enters a **staff password**
3. App calls `POST /api/staff/login`
4. If valid:
   - Staff tool unlocks and shows “Generate code”
5. Staff generates code with:
   - **Client phone (or last4)**
   - **Optional clientRef/name (internal)**
   - **Expiry days**
   - **Max uses**
6. App calls `POST /api/staff/create-code` and displays:
   - New code (plaintext, returned only once)
   - Expiration date/time
   - Copyable message template for staff to send

---

## Content Requirements (Copy)

### Page headline
- “Admissions / Intake”

### Instructions
- “This intake form was shared privately by Isoke Developmental Services. Enter your access code to begin.”

### Help / Contact (from admissions packet)
- **Main line**: `1-(844) ISOKE-13` / `(844)-476-5313`
- **After-hours**: `(844)-476-5313`
- **Emergency after-hours**: `267-983-8856`
- **Email**: `admin@isokedevelops.com` (administrative), `nursing@isokedevelops.com` (clinical)

### Indexing
- Must include `noindex, nofollow` meta tags.

---

## Technical Architecture

### Hosting
- Separate Vercel project for the intake module
- Domain: `intake.isokedevelops.com`
- DNS: `CNAME intake -> Vercel target` (per Vercel domain instructions)

### Frontend
- React + TypeScript (minimal single page)
- No Jotform iframe rendered until access is verified

### Backend (Server routes)
- Server endpoints (Vercel functions / API routes) handle:
  - Access code verification
  - Staff login session
  - Code creation
- Browser never has direct DB credentials

### DB
- **Supabase Postgres**
- Stores only access codes + usage metadata (not intake responses)

---

## Environment Variables

### Public (frontend)
- `VITE_JOTFORM_EMBED_URL`: The full embed URL (or form URL) to load in an iframe.

### Server-only
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STAFF_PASSWORD_HASH` (bcrypt/argon hash of staff password)
- `STAFF_SESSION_SIGNING_SECRET` (sign staff session tokens)
- `CODE_HASH_PEPPER` (server-only pepper for hashing codes)
- Optional rate limit config:
  - `VERIFY_RATE_LIMIT_WINDOW_MS`
  - `VERIFY_RATE_LIMIT_MAX`

---

## Access Code Rules

### Format
- `ISOKE-<LAST4>-<SUFFIX>`
  - `LAST4`: 4 digits (last 4 digits of client phone)
  - `SUFFIX`: 6 characters from a typo-resistant alphabet (avoid `O/0` and `I/1`)

Example:
- `ISOKE-5313-K7M4Q9`

### Security notes
- Do **not** store plaintext codes in DB.
- Store a deterministic hash so lookups are possible:
  - `code_hash = SHA256(UPPER(TRIM(code)) + CODE_HASH_PEPPER)`

---

## Supabase Schema

### Table: `intake_codes`
- `id` uuid primary key default `gen_random_uuid()`
- `code_hash` text unique not null
- `last4` text not null
- `client_ref` text null (internal only; can store “name” or “ref”)
- `expires_at` timestamptz not null
- `max_uses` int not null default 5
- `used_count` int not null default 0
- `revoked` boolean not null default false
- `created_at` timestamptz not null default now()

### RLS / Permissions
- Enable RLS.
- No client-side access to this table.
- Only server routes use the Supabase service role key.

---

## API Endpoints

### `POST /api/verify-code`
- **Body**: `{ code: string }`
- **Behavior**:
  - Normalize `code` (trim + uppercase)
  - Compute `code_hash`
  - Fetch matching row
  - Reject if:
    - not found
    - revoked
    - expired (`now() > expires_at`)
    - used up (`used_count >= max_uses`)
  - Increment `used_count` atomically on success
- **Responses**:
  - `200 { ok: true }`
  - `401 { ok: false, reason: 'invalid' | 'expired' | 'revoked' | 'used' }`
  - `429 { ok: false, reason: 'rate_limited' }`

### `POST /api/staff/login`
- **Body**: `{ password: string }`
- **Behavior**:
  - Verify against `STAFF_PASSWORD_HASH`
  - On success return a signed staff session token expiring in 60 minutes
- **Responses**:
  - `200 { ok: true, staffToken: string, expiresAt: string }`
  - `401 { ok: false }`

### `POST /api/staff/create-code`
- **Auth**: `Authorization: Bearer <staffToken>`
- **Body**:
  - `{ phone?: string, last4?: string, clientRef?: string, expiresInDays: number, maxUses: number }`
- **Behavior**:
  - Accept either:
    - `last4` directly, or
    - `phone` and extract digits → last4
  - Validate `last4` is exactly 4 digits
  - Generate new code `ISOKE-${last4}-${suffix}`
  - Store hashed code in DB with metadata
  - Return plaintext code to staff UI (only once)
- **Responses**:
  - `200 { ok: true, code: string, expiresAt: string }`
  - `401 { ok: false }`
  - `400 { ok: false, error: string }`

### Optional (v2): `POST /api/staff/revoke-code`
- Body: `{ code: string }`
- Marks `revoked = true`

---

## Rate Limiting (must-have)
- Apply per-IP rate limiting to `POST /api/verify-code`, e.g.:
  - 10 attempts per 10 minutes
- Add small backoff delays after failed attempts to reduce brute force.

---

## Frontend Behavior Details

### Unlock persistence
- Store unlock state in `sessionStorage`:
  - `sessionStorage.intakeUnlocked = '1'`
- On reload, if `intakeUnlocked === '1'`, render Jotform embed immediately.

### Staff session storage
- Store `staffToken` in `sessionStorage` only (never `localStorage`).

### Jotform embed
- Only render iframe once unlocked:
  - `<iframe src={VITE_JOTFORM_EMBED_URL} ... />`
- Provide fallback “Open in new tab” link to the same URL.

### Accessibility
- Inputs have labels
- Clear error states with remediation
- Keyboard focus moves to the error message on failure

---

## Acceptance Criteria (MVP)
- **AC1**: Jotform is not visible until a valid code is verified.
- **AC2**: Valid code unlocks the page and persists within the session via `sessionStorage`.
- **AC3**: Invalid/expired/revoked/used-up codes show a clear message and callback CTA.
- **AC4**: Staff tool is hidden until staff password is validated server-side.
- **AC5**: Staff tool includes all options:
  - client phone (or last4)
  - optional clientRef/name (internal)
  - expiry days
  - max uses
- **AC6**: Generated codes include last4 + random suffix; DB stores only a hash (no plaintext).
- **AC7**: `POST /api/verify-code` is rate limited.
- **AC8**: Page includes `noindex, nofollow`.
- **AC9**: Works on mobile and desktop.

---

## Staff Send Template (shown after code generation)
Hi — here is your Isoke Admissions/Intake link:
`https://intake.isokedevelops.com`

Access code:
`{{CODE}}`

If you need help, reply to this message or request a callback.
After-hours line: `(844)-476-5313`. Emergency after-hours: `267-983-8856`.

