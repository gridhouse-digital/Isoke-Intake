## Intake API Contracts

### `POST /api/verify-code`

Request

```json
{
  "code": "ISOKE-5313-K7M4Q9"
}
```

Success response

```json
{
  "ok": true
}
```

Failure responses

```json
{
  "ok": false,
  "reason": "invalid"
}
```

Possible `reason` values:
- `invalid`
- `expired`
- `revoked`
- `used`
- `rate_limited`

### `POST /api/staff/login`

Request

```json
{
  "password": "staff password"
}
```

Success response

```json
{
  "ok": true,
  "staffToken": "signed token",
  "expiresAt": "2026-03-18T20:40:00.000Z"
}
```

Failure response

```json
{
  "ok": false
}
```

### `POST /api/staff/create-code`

Headers

```txt
Authorization: Bearer <staffToken>
Content-Type: application/json
```

Request

```json
{
  "phone": "(844) 476-5313",
  "last4": "5313",
  "clientRef": "Jane Doe / Referral 42",
  "expiresInDays": 14,
  "maxUses": 5
}
```

Success response

```json
{
  "ok": true,
  "code": "ISOKE-5313-K7M4Q9",
  "expiresAt": "2026-04-01T20:40:00.000Z",
  "messageTemplate": "Hi — here is your Isoke Admissions/Intake link..."
}
```

Failure response

```json
{
  "ok": false,
  "error": "Provide a valid phone or a 4-digit last4 value."
}
```

### `POST /api/callback`

Request

```json
{
  "name": "Jane Doe",
  "phone": "(267) 555-0199",
  "bestTime": "Tomorrow morning",
  "message": "I need help with my intake code.",
  "service": "intake_access_support"
}
```

Success response

```json
{
  "ok": true,
  "delivered": {
    "email": true,
    "webhook": false
  }
}
```
