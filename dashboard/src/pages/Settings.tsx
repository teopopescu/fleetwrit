import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { FLEETWRIT_URL } from '../data/api';
import { PageHead, SectionHead } from '../components/PageHead';
import { Stamp } from '../components/Stamp';

// Roadmap only — none of these are wired up on this server yet.
const PLANNED = [
  { title: 'IdP sign-in', detail: 'Okta / Microsoft Entra' },
  { title: 'Notifications', detail: 'Slack / email / webhook' },
  { title: 'Policy engines', detail: 'OPA / Cedar' },
  { title: 'Routing & queues', detail: 'per-queue reviewers' },
  { title: 'SCIM', detail: 'user & group provisioning' },
];

export function Settings() {
  const { isLive, endpointLabel } = useStore();
  const [kid, setKid] = useState<string>('—');

  // Live only: read the real signing key id from the server's JWKS.
  useEffect(() => {
    if (!isLive) return;
    let mounted = true;
    fetch(`${FLEETWRIT_URL ?? ''}/.well-known/jwks.json`, {
      headers: { accept: 'application/json' },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { keys?: { kid?: string }[] }) => {
        if (mounted) setKid(j.keys?.[0]?.kid ?? '—');
      })
      .catch(() => {
        if (mounted) setKid('—');
      });
    return () => {
      mounted = false;
    };
  }, [isLive]);

  const endpoint = isLive ? FLEETWRIT_URL || endpointLabel : 'Demo data · auth off';

  return (
    <div className="page">
      <PageHead
        index="05"
        file="settings"
        title="Settings"
        lede="What this server actually has configured. Identity, notifications and policy engines are on the roadmap."
      />

      <section className="panel">
        <SectionHead title="This server" />
        <dl className="args">
          <div className="args__row">
            <dt className="args__key mono">Endpoint</dt>
            <dd className="args__val mono">{endpoint}</dd>
          </div>
          <div className="args__row">
            <dt className="args__key mono">Auth</dt>
            <dd className="args__val">off · local (dev)</dd>
          </div>
          <div className="args__row">
            <dt className="args__key mono">Receipts</dt>
            <dd className="args__val">
              Ed25519 (EdDSA) · JWKS at{' '}
              <span className="mono">/.well-known/jwks.json</span>
            </dd>
          </div>
          <div className="args__row">
            <dt className="args__key mono">Key id</dt>
            <dd className="args__val mono">{kid}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <SectionHead title="Planned" note="roadmap · not configured" />
        <ul className="reg">
          {PLANNED.map((p) => (
            <li key={p.title} className="reg__row reg__row--3">
              <span className="reg__key">{p.title}</span>
              <span className="reg__sub mono">{p.detail}</span>
              <Stamp variant="stamp--muted">planned</Stamp>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
