import { LockKeyhole, RefreshCw, Send, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { buildStaffEmailTemplate, STAFF_SEND_SUBJECT, STAFF_SEND_TEMPLATE } from '../lib/content'
import { postJson } from '../lib/request'
import { STAFF_TOKEN_KEY, clearSessionFlag, getSessionFlag, setSessionFlag } from '../lib/storage'
import type { CreateCodeResponse, SendCodeEmailResponse, StaffLoginResponse, StaffSessionResponse } from '../types/api'

interface StaffToolsProps {
  onOpenAudit: () => void
  onSessionStateChange: (isActive: boolean) => void
}

export function StaffTools({ onOpenAudit, onSessionStateChange }: StaffToolsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [staffToken, setStaffToken] = useState(() => getSessionFlag(STAFF_TOKEN_KEY))
  const [phone, setPhone] = useState('')
  const [last4, setLast4] = useState('')
  const [clientRef, setClientRef] = useState('')
  const [expiresInDays, setExpiresInDays] = useState('14')
  const [maxUses, setMaxUses] = useState('5')
  const [feedback, setFeedback] = useState('')
  const [generatedCode, setGeneratedCode] = useState('')
  const [emailSubject, setEmailSubject] = useState(STAFF_SEND_SUBJECT)
  const [messageTemplate, setMessageTemplate] = useState(STAFF_SEND_TEMPLATE)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isSessionChecking, setIsSessionChecking] = useState(false)
  const [feedbackTone, setFeedbackTone] = useState<'error' | 'success'>('success')
  const toggleButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)

  const loginLabel = useMemo(() => {
    if (isSessionChecking && staffToken) {
      return 'Checking staff session'
    }

    return staffToken ? 'Staff tools unlocked' : 'Staff tools'
  }, [isSessionChecking, staffToken])

  const expireSession = useCallback((message = 'Staff session expired. Please log in again.') => {
    clearSessionFlag(STAFF_TOKEN_KEY)
    setStaffToken('')
    onSessionStateChange(false)
    setGeneratedCode('')
    setEmailSubject(STAFF_SEND_SUBJECT)
    setMessageTemplate(STAFF_SEND_TEMPLATE)
    setRecipientEmail('')
    setExpiresAt('')
    setFeedbackTone('error')
    setFeedback(message)
  }, [onSessionStateChange])

  const validateSession = useCallback(async () => {
    if (!staffToken) {
      return false
    }

    setIsSessionChecking(true)
    const result = await postJson<StaffSessionResponse>(
      '/api/staff/session',
      {},
      {
        headers: {
          Authorization: `Bearer ${staffToken}`,
        },
        networkErrorMessage: 'Unable to verify the staff session right now.',
      },
    )
    setIsSessionChecking(false)

    if (result.ok && result.data?.ok) {
      onSessionStateChange(true)
      return true
    }

    expireSession()
    return false
  }, [expireSession, onSessionStateChange, staffToken])

  const closeDrawer = useCallback(() => {
    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && drawerRef.current?.contains(activeElement)) {
      toggleButtonRef.current?.focus()
    }

    setIsOpen(false)
  }, [])

  useEffect(() => {
    if (!staffToken) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void validateSession()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [staffToken, validateSession])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback('')
    setFeedbackTone('success')

    const result = await postJson<StaffLoginResponse>('/api/staff/login', { password }, {
      networkErrorMessage: 'Local API is not running. Start `npm run dev:full` or `npm run dev:api`.',
    })
    const data = result.data

    if (!result.ok || !data?.ok || !data.staffToken) {
      setIsSubmitting(false)
      setFeedbackTone('error')
      setFeedback(result.errorMessage || 'Staff password was rejected.')
      return
    }

    setSessionFlag(STAFF_TOKEN_KEY, data.staffToken)
    setStaffToken(data.staffToken)
    onSessionStateChange(true)
    setPassword('')
    setFeedback(`Staff access unlocked until ${data.expiresAt ?? 'the session expires'}.`)
    setIsSubmitting(false)
  }

  const handleCreateCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback('')
    setFeedbackTone('success')

    const result = await postJson<CreateCodeResponse>(
      '/api/staff/create-code',
      {
        clientRef: clientRef || undefined,
        expiresInDays: Number(expiresInDays),
        last4: last4 || undefined,
        maxUses: Number(maxUses),
        phone: phone || undefined,
      },
      {
        headers: {
          'Authorization': `Bearer ${staffToken}`,
        },
        networkErrorMessage: 'Local API is not running. Start `npm run dev:full` or `npm run dev:api`.',
      },
    )
    const data = result.data

    if (!result.ok || !data?.ok || !data.code) {
      if (result.status === 401) {
        setIsSubmitting(false)
        expireSession()
        return
      }

      setIsSubmitting(false)
      setFeedbackTone('error')
      setFeedback(result.errorMessage || data?.error || 'Code generation failed.')
      return
    }

    setGeneratedCode(data.code)
    setEmailSubject(data.subject || STAFF_SEND_SUBJECT)
    setMessageTemplate(data.messageTemplate || buildStaffEmailTemplate(clientRef, data.code))
    setExpiresAt(data.expiresAt || '')
    setFeedback('Code generated. Review the draft email below, then send it to the client.')
    setIsSubmitting(false)
  }

  const handleSendEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSendingEmail(true)
    setFeedback('')
    setFeedbackTone('success')

    const result = await postJson<SendCodeEmailResponse>(
      '/api/staff/send-code-email',
      {
        message: messageTemplate,
        subject: emailSubject,
        to: recipientEmail,
      },
      {
        headers: {
          'Authorization': `Bearer ${staffToken}`,
        },
        networkErrorMessage: 'Unable to reach the email service right now.',
      },
    )

    if (!result.ok || !result.data?.ok) {
      if (result.status === 401) {
        setIsSendingEmail(false)
        expireSession()
        return
      }

      setIsSendingEmail(false)
      setFeedbackTone('error')
      setFeedback(result.errorMessage || result.data?.error || 'Unable to send the intake email right now.')
      return
    }

    setIsSendingEmail(false)
    setFeedbackTone('success')
    setFeedback('Intake email sent.')
  }

  const handleLogout = () => {
    clearSessionFlag(STAFF_TOKEN_KEY)
    setStaffToken('')
    onSessionStateChange(false)
    setGeneratedCode('')
    setEmailSubject(STAFF_SEND_SUBJECT)
    setMessageTemplate(STAFF_SEND_TEMPLATE)
    setRecipientEmail('')
    setExpiresAt('')
    setFeedbackTone('success')
    setFeedback('Staff session cleared.')
  }

  return (
    <>
      <button
        ref={toggleButtonRef}
        className="floating-staff-toggle"
        onClick={async () => {
          if (isOpen) {
            closeDrawer()
            return
          }

          if (staffToken) {
            const isValid = await validateSession()
            if (!isValid) {
              setIsOpen(true)
              return
            }
          }

          setIsOpen(true)
        }}
        type="button"
        aria-expanded={isOpen}
        aria-controls="staff-drawer"
      >
        <LockKeyhole size={16} />
        <span>{loginLabel}</span>
      </button>

      <div className={`staff-drawer-backdrop${isOpen ? ' is-open' : ''}`} onClick={closeDrawer} />

      <aside ref={drawerRef} className={`staff-drawer${isOpen ? ' is-open' : ''}`} id="staff-drawer" aria-hidden={!isOpen}>
        <section className="surface-panel staff-panel">
          <div className="staff-drawer-header">
            <div>
              <div className="eyebrow">Staff tools</div>
              <h3>{staffToken ? 'Generate a private intake code.' : 'Unlock the staff drawer.'}</h3>
            </div>
            <div className="staff-drawer-header-actions">
              {staffToken ? (
                <button className="ghost-button" type="button" onClick={handleLogout}>
                  Log out
                </button>
              ) : null}
              <button className="icon-button" onClick={closeDrawer} type="button" aria-label="Close staff tools">
                <X size={16} />
              </button>
            </div>
          </div>

          <section className="staff-hero">
            <div className="staff-hero-copy">
              <div className="staff-status-pill">
                <LockKeyhole size={14} />
                <span>{staffToken ? 'Secure session active' : 'Protected workspace'}</span>
              </div>
              <h4>{staffToken ? 'Staff operations workspace' : 'Private access for intake operations'}</h4>
              <p>
                {staffToken
                  ? 'Create codes, review the outbound message, and move directly into audit without leaving this control room.'
                  : 'Sign in to open the intake operations workspace for code generation, email delivery, and audit review.'}
              </p>
            </div>
            <div className="staff-hero-meta">
              <div className="staff-hero-metric">
                <strong>{staffToken ? 'Session' : 'Access'}</strong>
                <span>{staffToken ? 'Unlocked' : 'Locked'}</span>
              </div>
              <div className="staff-hero-metric">
                <strong>Workflow</strong>
                <span>{staffToken ? 'Generate, send, audit' : 'Authenticate to begin'}</span>
              </div>
            </div>
          </section>

          {!staffToken ? (
            <section className="staff-login-shell">
              <div className="generated-panel staff-login-panel">
                <div>
                  <div className="eyebrow">Authentication</div>
                  <h4>Open the private operations drawer</h4>
                  <p>Use the staff password to access code generation, client email drafting, and audit review.</p>
                </div>

                <form className="form-grid staff-login-form" onSubmit={handleLogin}>
                  <label className="full-width">
                    Staff password
                    <input
                      autoComplete="current-password"
                      className="staff-password-input"
                      name="staffPassword"
                      type="password"
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      required
                    />
                  </label>

                  <button className="secondary-button staff-login-button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Checking...' : 'Unlock staff tools'}
                  </button>
                </form>
              </div>
            </section>
          ) : (
            <div className="staff-workspace">
              <div className="staff-main-column">
                <div className="generated-panel staff-command-panel">
                  <div className="staff-panel-intro">
                    <div className="eyebrow">Code generation</div>
                    <h4>Create a secure intake code</h4>
                    <p>Use either phone or last 4 digits, then set usage and expiry before drafting the outbound email.</p>
                  </div>

                  <form className="form-grid" onSubmit={handleCreateCode}>
                    <label>
                      Client phone
                      <input
                        autoComplete="tel"
                        name="clientPhone"
                        value={phone}
                        onChange={event => setPhone(event.target.value)}
                        placeholder="(844) 476-5313"
                      />
                    </label>

                    <label>
                      Or last 4 digits
                      <input
                        autoComplete="off"
                        name="clientLast4"
                        value={last4}
                        onChange={event => setLast4(event.target.value)}
                        placeholder="5313"
                      />
                    </label>

                    <label>
                      Expiry days
                      <input
                        autoComplete="off"
                        name="expiresInDays"
                        inputMode="numeric"
                        min="1"
                        type="number"
                        value={expiresInDays}
                        onChange={event => setExpiresInDays(event.target.value)}
                        required
                      />
                    </label>

                    <label>
                      Max uses
                      <input
                        autoComplete="off"
                        name="maxUses"
                        inputMode="numeric"
                        min="1"
                        type="number"
                        value={maxUses}
                        onChange={event => setMaxUses(event.target.value)}
                        required
                      />
                    </label>

                    <label className="full-width">
                      Client Name
                      <input
                        autoComplete="off"
                        name="clientRef"
                        value={clientRef}
                        onChange={event => setClientRef(event.target.value)}
                      />
                    </label>

                    <div className="staff-actions full-width">
                      <button className="secondary-button" type="submit" disabled={isSubmitting}>
                        <Sparkles size={16} />
                        {isSubmitting ? 'Generating...' : 'Generate code'}
                      </button>

                      <button className="ghost-button" type="button" onClick={handleLogout}>
                        Clear session
                      </button>
                    </div>
                  </form>
                </div>

                <div className="generated-panel staff-email-panel">
                  <div className="eyebrow">Email draft</div>
                  <h3>Review and send the intake email</h3>

                  <div className="generated-summary-grid">
                    <div className="summary-card">
                      <strong>Access code</strong>
                      <p>{generatedCode || 'No code generated yet.'}</p>
                    </div>

                    <div className="summary-card">
                      <strong>Expires</strong>
                      <p>{expiresAt || 'Waiting for a generated code.'}</p>
                    </div>
                  </div>

                  {feedback ? (
                    <p
                      className={`staff-feedback ${feedbackTone === 'success' ? 'status-success' : 'status-error'}`}
                      role="status"
                      aria-live="polite"
                    >
                      {feedback}
                    </p>
                  ) : null}

                  <form className="email-send-form" onSubmit={handleSendEmail}>
                    <div className="email-send-header">
                      <div>
                        <strong>Email sender</strong>
                        <p>Edit the draft before sending it to the client or family.</p>
                      </div>
                    </div>

                    <label className="full-width">
                      Recipient email
                      <input
                        autoComplete="email"
                        name="recipientEmail"
                        type="email"
                        value={recipientEmail}
                        onChange={event => setRecipientEmail(event.target.value)}
                        placeholder="family@example.com"
                        required
                      />
                    </label>

                    <label className="full-width">
                      Subject
                      <input value={emailSubject} onChange={event => setEmailSubject(event.target.value)} required />
                    </label>

                    <label className="full-width">
                      Email message
                      <textarea rows={12} value={messageTemplate} onChange={event => setMessageTemplate(event.target.value)} required />
                    </label>

                    <button className="secondary-button full-width-button" type="submit" disabled={isSendingEmail || !generatedCode}>
                      <Send size={16} />
                      {isSendingEmail ? 'Sending...' : 'Send intake email'}
                    </button>
                  </form>
                </div>
              </div>

              <div className="staff-side-column">
                <div className="generated-panel staff-side-panel">
                  <div className="eyebrow">Session</div>
                  <h4>Operator status</h4>
                  <div className="staff-side-stack">
                    <div className="summary-card staff-side-card">
                      <strong>Workspace</strong>
                      <p>Authenticated and ready for intake operations.</p>
                    </div>
                    <div className="summary-card staff-side-card">
                      <strong>Next move</strong>
                      <p>Generate a code, confirm the draft, then send or jump into audit.</p>
                    </div>
                  </div>
                </div>

                <div className="generated-panel staff-side-panel">
                  <div className="eyebrow">Audit</div>
                  <h3>Review generated codes and status</h3>
                  <p>Open the audit page to search records, filter by status, inspect usage, and revoke active codes.</p>
                  <button
                    className="ghost-button full-width-button"
                    type="button"
                    onClick={() => {
                      closeDrawer()
                      onOpenAudit()
                    }}
                  >
                    <RefreshCw size={16} />
                    Open audit page
                  </button>
                </div>
              </div>
            </div>
          )}

          {!staffToken && feedback ? (
            <p className={`staff-feedback ${feedbackTone === 'success' ? 'status-success' : 'status-error'}`} role="status" aria-live="polite">
              {feedback}
            </p>
          ) : null}
        </section>
      </aside>
    </>
  )
}
