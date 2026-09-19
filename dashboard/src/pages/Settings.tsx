import { PageHead, SectionHead } from '../components/PageHead';
import { Stamp } from '../components/Stamp';

export function Settings() {
  return (
    <div className="page">
      <PageHead
        index="05"
        file="settings.stub"
        title="Settings"
        lede="Read-only in demo mode. Shows the shape of a configured workspace."
      />

      <div className="grid-2">
        <section className="panel">
          <SectionHead title="Identity" />
          <dl className="args">
            <div className="args__row">
              <dt className="args__key mono">IdP connection</dt>
              <dd className="args__val">
                Okta <span className="mono">(demo)</span>
              </dd>
            </div>
            <div className="args__row">
              <dt className="args__key mono">Auth</dt>
              <dd className="args__val"><Stamp variant="stamp--muted">off · demo</Stamp></dd>
            </div>
            <div className="args__row">
              <dt className="args__key mono">Signing key</dt>
              <dd className="args__val mono">key_fw_2026_a · ed25519</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <SectionHead title="Notifications" />
          <dl className="args">
            <div className="args__row">
              <dt className="args__key mono">Slack webhook</dt>
              <dd className="args__val mono">#fleetwrit-approvals</dd>
            </div>
            <div className="args__row">
              <dt className="args__key mono">Email digest</dt>
              <dd className="args__val">Hourly + per-request</dd>
            </div>
            <div className="args__row">
              <dt className="args__key mono">OPA bundle</dt>
              <dd className="args__val mono">rev 41 · <Stamp variant="stamp--green">synced</Stamp></dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="panel">
        <SectionHead title="Queues" />
        <ul className="reg">
          {[
            { q: 'finance-ops', reviewers: 'support@acme.com, marcus@acme.com' },
            { q: 'sre-oncall', reviewers: 'platform@acme.com, dana@acme.com' },
            { q: 'privacy', reviewers: 'privacy@acme.com' },
          ].map((r) => (
            <li key={r.q} className="reg__row reg__row--3">
              <span className="reg__key mono">{r.q}</span>
              <span className="reg__sub mono">{r.reviewers}</span>
              <Stamp variant="stamp--accent">routed</Stamp>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
