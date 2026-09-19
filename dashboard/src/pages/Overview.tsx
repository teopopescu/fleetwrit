import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/store';
import { PageHead, SectionHead } from '../components/PageHead';
import { RiskStamp, Stamp } from '../components/Stamp';
import { IconArrowDown, IconArrowRight, IconCheck, IconFlag } from '../components/Icons';
import { minsLabel } from '../lib/format';

const RANGES = [
  { k: '24h', label: '24 hours', days: 1 },
  { k: '7d', label: '7 days', days: 7 },
  { k: '30d', label: '30 days', days: 30 },
  { k: '3mo', label: '3 months', days: 90 },
] as const;
type RangeKey = (typeof RANGES)[number]['k'];

// Deterministic synthetic decisions-per-bucket series (illustrative demo data).
function series(range: RangeKey): { label: string; value: number }[] {
  const spec = RANGES.find((r) => r.k === range)!;
  const buckets = range === '24h' ? 12 : range === '7d' ? 7 : range === '30d' ? 30 : 12;
  const out: { label: string; value: number }[] = [];
  for (let i = 0; i < buckets; i++) {
    const seed = Math.sin((i + 1) * (spec.days + 2.3)) * 43758.5453;
    const frac = seed - Math.floor(seed);
    out.push({ label: String(i + 1), value: Math.round(24 + frac * 46) });
  }
  return out;
}

function StatTile({ label, value, foot }: { label: string; value: ReactNode; foot: ReactNode }) {
  return (
    <div className="tile">
      <div className="tile__label mono">{label}</div>
      <div className="tile__value mono tnum">{value}</div>
      <div className="tile__foot">{foot}</div>
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);
  const W = 720;
  const H = 150;
  const pad = 8;
  const bw = (W - pad * 2) / data.length;
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Decisions per bucket, ${total} total across ${data.length} buckets`}
    >
      <line x1="0" y1={H - 18} x2={W} y2={H - 18} className="chart__axis" />
      {data.map((d, i) => {
        const h = ((d.value / max) * (H - 34));
        return (
          <rect
            key={i}
            x={pad + i * bw + bw * 0.16}
            y={H - 18 - h}
            width={bw * 0.68}
            height={h}
            rx="1.5"
            className="chart__bar"
          >
            <title>{d.value} decisions</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function Overview() {
  const { requests, agents } = useStore();
  const [range, setRange] = useState<RangeKey>('7d');
  const data = useMemo(() => series(range), [range]);
  const rangeTotal = data.reduce((s, d) => s + d.value, 0);

  const pending = requests.filter((r) => r.status === 'pending');
  const highCount = pending.filter((r) => r.risk === 'high' || r.risk === 'critical').length;
  const oldest = pending.reduce((m, r) => Math.max(m, r.createdMinAgo), 0);

  const byQueue = Object.entries(
    pending.reduce<Record<string, number>>((acc, r) => {
      acc[r.queue] = (acc[r.queue] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const byRuntime = Object.entries(
    agents.reduce<Record<string, number>>((acc, a) => {
      acc[a.runtime] = (acc[a.runtime] ?? 0) + 1;
      return acc;
    }, {}),
  );

  const undeclared = agents.filter((a) => a.undeclaredActionType);

  const integrations = [
    { name: 'Email notifier', detail: 'digest + per-request', ok: true },
    { name: 'Slack webhook', detail: '#fleetwrit-approvals', ok: true },
    { name: 'OPA policy', detail: 'bundle rev 41', ok: true },
  ];

  return (
    <div className="page">
      <PageHead title="Overview" lede="What your agents are waiting on, who is acting, and whether the record holds." />

      <div className="range" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r.k}
            role="tab"
            aria-selected={range === r.k}
            className={'range__tab' + (range === r.k ? ' is-active' : '')}
            onClick={() => setRange(r.k)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="tiles">
        <StatTile
          label="Pending now"
          value={pending.length}
          foot={<span className="mono tnum">{highCount} high · oldest {minsLabel(oldest)}</span>}
        />
        <StatTile
          label="Human minutes / 1,000 tasks"
          value={38}
          foot={
            <span className="tile__delta tile__delta--good">
              <IconArrowDown size={15} />
              <span className="mono tnum">21% vs baseline</span>
            </span>
          }
        />
        <StatTile
          label="Decisions in range"
          value={rangeTotal}
          foot={<span className="mono tnum">96% approved · 1% expired</span>}
        />
        <StatTile
          label="Undeclared actions"
          value={undeclared.length}
          foot={
            <span className="tile__delta tile__delta--flag">
              <IconFlag size={14} />
              <span>flagged for review</span>
            </span>
          }
        />
      </div>

      <section className="panel">
        <SectionHead title="Decisions per day" note={`${rangeTotal} in range`} />
        <BarChart data={data} />
      </section>

      <div className="grid-2">
        <section className="panel">
          <SectionHead title="Pending by queue" note={`${pending.length} open`} />
          <ul className="reg">
            {byQueue.map(([queue, n]) => (
              <li key={queue} className="reg__row">
                <span className="reg__key mono">{queue}</span>
                <span className="reg__bar" aria-hidden>
                  <span className="reg__bar-fill" style={{ width: `${(n / pending.length) * 100}%` }} />
                </span>
                <span className="reg__val mono tnum">{n}</span>
              </li>
            ))}
          </ul>
          <Link to="/inbox" className="panel__more">
            Open inbox <IconArrowRight size={15} />
          </Link>
        </section>

        <section className="panel">
          <SectionHead title="Agents by runtime" note={`${agents.length} registered`} />
          <ul className="reg">
            {byRuntime.map(([runtime, n]) => (
              <li key={runtime} className="reg__row">
                <span className="reg__key">{runtime}</span>
                <span className="reg__bar" aria-hidden>
                  <span className="reg__bar-fill" style={{ width: `${(n / agents.length) * 100}%` }} />
                </span>
                <span className="reg__val mono tnum">{n}</span>
              </li>
            ))}
          </ul>
          <Link to="/agents" className="panel__more">
            View agents <IconArrowRight size={15} />
          </Link>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <SectionHead title="Integration health" />
          <ul className="reg">
            {integrations.map((i) => (
              <li key={i.name} className="reg__row reg__row--3">
                <span className="reg__key">{i.name}</span>
                <span className="reg__sub mono">{i.detail}</span>
                <Stamp variant="stamp--green">ok</Stamp>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <SectionHead title="Coverage gaps" note="2 findings" />
          <ul className="gaps">
            <li className="gap">
              <IconFlag size={16} className="gap__icon" />
              <div>
                <div className="gap__title">1 agent with 0 gated actions</div>
                <div className="gap__note mono">
                  ap-invoices · staging — actions run without a registered policy
                </div>
              </div>
            </li>
            <li className="gap">
              <IconFlag size={16} className="gap__icon" />
              <div>
                <div className="gap__title">1 undeclared action type</div>
                <div className="gap__note mono">
                  {undeclared[0]?.undeclaredActionType ?? 'vendor.payout'} observed on{' '}
                  {undeclared[0]?.id ?? 'ap-invoices'}
                </div>
              </div>
            </li>
          </ul>
          <Link to="/catalog" className="panel__more">
            Review catalog <IconArrowRight size={15} />
          </Link>
        </section>
      </div>

      <div className="chain-strip">
        <span className="chain-strip__stamp">
          <IconCheck size={16} />
          <span className="mono">Ledger chain intact</span>
        </span>
        <RiskStamp risk="critical" />
        <span className="chain-strip__note mono">1 critical request awaiting a reviewer</span>
      </div>
    </div>
  );
}
