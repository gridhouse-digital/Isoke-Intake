import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, KeyRound, LoaderCircle, UnlockKeyhole } from 'lucide-react'
import { VERIFY_ERROR_COPY } from '../lib/content'
import { postJson } from '../lib/request'
import type { VerifyCodeResponse, VerifyFailureReason } from '../types/api'

interface AccessGateProps {
  onUnlock: () => void
}

export function AccessGate({ onUnlock }: AccessGateProps) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errorReason, setErrorReason] = useState<VerifyFailureReason | ''>('')
  const [errorMessage, setErrorMessage] = useState('')
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (status === 'error') {
      errorRef.current?.focus()
    }
  }, [status])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('submitting')
    setErrorReason('')
    setErrorMessage('')

    const result = await postJson<VerifyCodeResponse>('/api/verify-code', { code }, {
      networkErrorMessage: 'The intake service is unavailable right now. Please request a callback.',
    })
    const data = result.data

    if (result.ok && data?.ok) {
      onUnlock()
      return
    }

    setStatus('error')
    setErrorReason(data?.reason || '')
    setErrorMessage(result.errorMessage || (data?.reason ? VERIFY_ERROR_COPY[data.reason] : 'Unable to verify that code right now.'))
  }

  return (
    <section className="surface-panel gate-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Private access</div>
          <h2>Enter your intake code to begin.</h2>
          <p>This intake form was shared privately by Isoke Developmental Services. Enter your access code to begin.</p>
        </div>
        <div className="badge-pill">
          <KeyRound size={15} />
          Format: ISOKE-5313-K7M4Q9
        </div>
      </div>

      <form className="gate-form" onSubmit={handleSubmit}>
        <label>
          Access code
          <input
            autoComplete="off"
            inputMode="text"
            name="accessCode"
            onChange={event => setCode(event.target.value.toUpperCase())}
            placeholder="ISOKE-1234-ABCDEF"
            value={code}
            required
          />
        </label>

        <button className="primary-button" type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? (
            <>
              <LoaderCircle size={16} className="spin" />
              Verifying...
            </>
          ) : (
            <>
              <UnlockKeyhole size={16} />
              Unlock intake form
            </>
          )}
        </button>
      </form>

      {errorReason || errorMessage ? (
        <p className="error-banner" ref={errorRef} tabIndex={-1} role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage || VERIFY_ERROR_COPY[errorReason]}</span>
        </p>
      ) : null}
    </section>
  )
}
