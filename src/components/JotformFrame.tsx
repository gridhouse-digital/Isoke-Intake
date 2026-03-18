import { ArrowUpRight, ShieldCheck } from 'lucide-react'

interface JotformFrameProps {
  url: string
}

export function JotformFrame({ url }: JotformFrameProps) {
  return (
    <section className="surface-panel unlocked-panel">
      <div className="panel-header">
        <div>
          <div className="eyebrow">Unlocked</div>
          <h2>Your intake form is ready.</h2>
          <p>The secure Jotform embed is only shown after your code is verified.</p>
        </div>

        <a className="ghost-button" href={url} target="_blank" rel="noreferrer">
          Open in new tab
          <ArrowUpRight size={16} />
        </a>
      </div>

      <div className="inline-note">
        <ShieldCheck size={16} />
        <span>If the embed stalls, use the new-tab link above. Access remains available only while this page stays unlocked or staff access is active.</span>
      </div>

      <div className="iframe-shell">
        <iframe
          title="Isoke Admissions Intake Form"
          src={url}
          width="100%"
          height="980"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </section>
  )
}
