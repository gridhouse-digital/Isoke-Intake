import { useMemo, useState } from 'react'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { CallbackForm } from './components/CallbackForm'
import { AccessGate } from './components/AccessGate'
import { JotformFrame } from './components/JotformFrame'
import { StaffTools } from './components/StaffTools'
import { SupportCard } from './components/SupportCard'
import { useDocumentMeta } from './lib/useDocumentMeta'
import { AuditPage } from './pages/AuditPage'

function IntakeHome() {
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [hasStaffAccess, setHasStaffAccess] = useState(false)
  const [isCallbackOpen, setIsCallbackOpen] = useState(false)
  const jotformUrl = import.meta.env.VITE_JOTFORM_EMBED_URL?.trim() ?? ''
  const navigate = useNavigate()

  useDocumentMeta({
    title: 'Admissions / Intake | Isoke Developmental Services',
    description: 'Private Isoke admissions and intake portal.',
    canonical: 'https://intake.isokedevelops.com/',
  })

  const callbackDefaultMessage = useMemo(
    () =>
      isUnlocked || hasStaffAccess
        ? 'I can access the intake page, but I still need help with next steps.'
        : 'I need help with my Isoke intake access code.',
    [hasStaffAccess, isUnlocked],
  )

  const handleUnlock = () => {
    setIsUnlocked(true)
  }

  return (
    <main className="app-shell">
      <section className="hero-shell">
        <div className="hero-copy">
          <div className="eyebrow">Admissions / Intake</div>
          <h1>A private intake path for clients and families.</h1>
          <p className="hero-lead">
            This portal is only shared directly by Isoke Developmental Services. Enter your code to continue to the secure
            admissions packet.
          </p>
        </div>

        <SupportCard />
      </section>

      <section className={`content-shell${isUnlocked ? ' is-unlocked' : ''}`}>
        {isUnlocked || hasStaffAccess ? (
          <>
            {jotformUrl ? (
              <JotformFrame url={jotformUrl} />
            ) : (
              <section className="surface-panel">
                <div className="eyebrow">Configuration needed</div>
                <h2>Set `VITE_JOTFORM_EMBED_URL` to render the intake form.</h2>
                <p>The unlock flow is ready, but the embed URL is still missing from the environment.</p>
              </section>
            )}
            <section className="surface-panel callback-cta-panel">
              <div>
                <div className="eyebrow">Need help?</div>
                <h3>Need a human follow-up after unlocking?</h3>
                <p>Open the callback popup and the Isoke team can reach back out directly.</p>
              </div>
              <button className="primary-button" type="button" onClick={() => setIsCallbackOpen(true)}>
                Request a callback
              </button>
            </section>
          </>
        ) : (
          <>
            <AccessGate onUnlock={handleUnlock} />
            <section className="surface-panel callback-cta-panel">
              <div>
                <div className="eyebrow">Need help?</div>
                <h3>Need help with the intake code?</h3>
                <p>Open the callback popup and the Isoke team can follow up directly.</p>
              </div>
              <button className="primary-button" type="button" onClick={() => setIsCallbackOpen(true)}>
                Request a callback
              </button>
            </section>
          </>
        )}
      </section>

      <CallbackForm
        defaultMessage={callbackDefaultMessage}
        isOpen={isCallbackOpen}
        onClose={() => setIsCallbackOpen(false)}
      />
      <StaffTools
        onOpenAudit={() => navigate('/audit')}
        onSessionStateChange={setHasStaffAccess}
      />
    </main>
  )
}

function AppRoutes() {
  const navigate = useNavigate()

  return (
    <Routes>
      <Route path="/" element={<IntakeHome />} />
      <Route path="/audit" element={<AuditPage onBack={() => navigate('/')} />} />
      <Route path="*" element={<IntakeHome />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
