import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { PageHead } from '../components/PageHead';
import { RiskStamp } from '../components/Stamp';
import { IconArrowRight } from '../components/Icons';
import { minsLabel } from '../lib/format';
import type { Risk } from '../data/types';

const RISK_ORDER: Record<Risk, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function Inbox() {
  const { requests } = useStore();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<string>('all');

  const pending = requests.filter((r) => r.status === 'pending');
  const queues = useMemo(
    () => ['all', ...Array.from(new Set(pending.map((r) => r.queue)))],
    [pending],
  );

  const rows = useMemo(() => {
    return pending
      .filter((r) => queue === 'all' || r.queue === queue)
      .sort(
        (a, b) =>
          RISK_ORDER[a.risk] - RISK_ORDER[b.risk] ||
          a.expiresInMin - b.expiresInMin,
      );
  }, [pending, queue]);

  return (
    <div className="page">
      <PageHead
        index="01"
        file="inbox.queue"
        title="Inbox"
        lede="Pending requests awaiting your decision, sorted by risk then soonest expiry."
      />

      <div className="toolbar">
        <div className="filters" role="group" aria-label="Filter by queue">
          {queues.map((q) => (
            <button
              key={q}
              type="button"
              className={'filter' + (queue === q ? ' is-active' : '')}
              onClick={() => setQueue(q)}
            >
              <span className="mono">{q}</span>
              {q !== 'all' && (
                <span className="filter__count mono tnum">
                  {pending.filter((r) => r.queue === q).length}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="toolbar__count mono tnum">{rows.length} shown</span>
      </div>

      <div className="table" role="table" aria-label="Pending requests">
        <div className="table__head" role="row">
          <span role="columnheader" className="mono">Agent</span>
          <span role="columnheader" className="mono">Action</span>
          <span role="columnheader" className="mono">Risk</span>
          <span role="columnheader" className="mono">Queue</span>
          <span role="columnheader" className="mono col-right">Time left</span>
          <span role="columnheader" className="sr-only">Open</span>
        </div>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            className="table__row table__row--btn"
            role="row"
            onClick={() => navigate(`/requests/${r.id}`)}
          >
            <span role="cell" className="mono">{r.agentId}</span>
            <span role="cell" className="table__title">{r.title}</span>
            <span role="cell"><RiskStamp risk={r.risk} /></span>
            <span role="cell" className="mono">{r.queue}</span>
            <span role="cell" className="mono tnum col-right">{minsLabel(r.expiresInMin)}</span>
            <span role="cell" className="table__go" aria-hidden><IconArrowRight size={16} /></span>
          </button>
        ))}
        {rows.length === 0 && pending.length === 0 && (
          <div className="empty">
            No pending requests yet.
            <span className="empty__hint mono">
              Run an agent against this server, or start with <code>fleetwrit dev --demo</code>.
            </span>
          </div>
        )}
        {rows.length === 0 && pending.length > 0 && (
          <div className="empty">No pending requests in this queue.</div>
        )}
      </div>
    </div>
  );
}
