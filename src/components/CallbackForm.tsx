import { X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { postJson } from '../lib/request'
import type { CallbackResponse } from '../types/api'

interface CallbackFormProps {
  defaultMessage?: string
  isOpen: boolean
  onClose: () => void
}

export function CallbackForm({ defaultMessage = '', isOpen, onClose }: CallbackFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [bestTime, setBestTime] = useState('')
  const [message, setMessage] = useState(defaultMessage)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    setMessage(defaultMessage)
  }, [defaultMessage])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('sending')
    setFeedback('')

    const result = await postJson<CallbackResponse>(
      '/api/callback',
      {
        bestTime,
        message,
        name,
        phone,
        service: 'intake_access_support',
      },
      {
        networkErrorMessage: 'The callback service is unavailable right now. Please try again shortly.',
      },
    )
    const data = result.data

    if (!result.ok || !data?.ok) {
      setStatus('error')
      setFeedback(result.errorMessage || data?.error || 'We could not submit your callback request right now.')
      return
    }

    setStatus('success')
    setFeedback('Your callback request was sent. Someone from Isoke should reach out soon.')
    setName('')
    setPhone('')
    setBestTime('')
    setMessage(defaultMessage)
  }

  if (!isOpen) {
    return null
  }

  return (
    <>
      <div className="callback-modal-backdrop" onClick={onClose} />
      <section className="callback-modal-shell" aria-modal="true" role="dialog" aria-labelledby="callback-modal-title">
        <div className="surface-panel callback-panel">
          <div className="callback-modal-header">
            <div>
              <div className="eyebrow">Request a callback</div>
              <h3 id="callback-modal-title">Need help getting into the intake form?</h3>
              <p>Send your details and the Isoke team can follow up directly.</p>
            </div>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close callback form">
              <X size={16} />
            </button>
          </div>

          <form className="form-grid" onSubmit={handleSubmit}>
            <label>
              Full name
              <input value={name} onChange={event => setName(event.target.value)} required />
            </label>

            <label>
              Phone number
              <input value={phone} onChange={event => setPhone(event.target.value)} required />
            </label>

            <label>
              Best time to call
              <input value={bestTime} onChange={event => setBestTime(event.target.value)} required />
            </label>

            <label className="full-width">
              Message
              <textarea rows={5} value={message} onChange={event => setMessage(event.target.value)} />
            </label>

            <button className="primary-button full-width-button" type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending...' : 'Request callback'}
            </button>
          </form>

          {feedback ? (
            <p className={status === 'success' ? 'status-success' : 'status-error'} role="status">
              {feedback}
            </p>
          ) : null}
        </div>
      </section>
    </>
  )
}
