import { Mail, Phone, ShieldAlert } from 'lucide-react'
import { SUPPORT_LINES } from '../lib/content'

export function SupportCard() {
  return (
    <aside className="support-card">
      <div className="eyebrow">Need help?</div>
      <h2>Quick support if the code or form gets stuck.</h2>

      <div className="support-stack">
        <a className="support-row" href="tel:+18444765313">
          <Phone size={18} />
          <span>
            <strong>{SUPPORT_LINES.mainLineDisplay}</strong>
            <small>Office and after-hours: {SUPPORT_LINES.mainLineNumber}</small>
          </span>
        </a>

        <div className="support-row">
          <ShieldAlert size={18} />
          <span>
            <strong>Emergency after-hours</strong>
            <small>{SUPPORT_LINES.emergencyAfterHours}</small>
          </span>
        </div>

        <a className="support-row" href={`mailto:${SUPPORT_LINES.intakeEmail}`}>
          <Mail size={18} />
          <span>
            <strong>Intake email</strong>
            <small>{SUPPORT_LINES.intakeEmail}</small>
          </span>
        </a>
      </div>
    </aside>
  )
}
