import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { PageHead } from '../components/PageHead';
import { IconCheck } from '../components/Icons';
import { GENESIS_HASH } from '../data/seed';

function verifyChain(
  events: { payloadHash: string; prevHash: string }[],
): { intact: boolean; brokeAt: number | null } {
  let prev = GENESIS_HASH;
  for (let i = 0; i < events.length; i++) {
    if (events[i].prevHash !== prev) return { intact: false, brokeAt: i };
    prev = events[i].payloadHash;
  }
  return { intact: true, brokeAt: null };
}

export function Ledger() {
  const { ledger, verifyLedger, isLive, overview } = useStore();
  const [query, setQuery] = useState('');
  const [verified, setVerified] = useState<null | boolean>(null);

  // In live mode the /v1/ledger window is truncated to the latest events, so a
  // local genesis-based check would report "broken" once the chain outgrows it.
  // Trust the server's own verification (overview.chain) there; keep the local
  // hash-chain check for demo/seed mode where the full chain is in memory.
  const localChain = useMemo(() => verifyChain(ledger), [ledger]);
  const chainIntact = isLive ? overview?.chain?.ok ?? true : localChain.intact;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...ledger].sort((a, b) => b.seq - a.seq);
    if (!q) return sorted;
    return sorted.filter(
      (e) =>
        e.payloadHash.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        (e.requestId ?? '').toLowerCase().includes(q) ||
        e.event.toLowerCase().includes(q),
    );
  }, [ledger, query]);

  return (
    <div className="page">
      <PageHead
        index="04"
        file="ledger.chain"
        title="Ledger"
        lede="Append-only record of every event. Each entry chains to the previous by hash."
        actions={
          <div className="ledger-actions">
            <span className={'chain-badge' + (chainIntact ? '' : ' is-broken')}>
              <IconCheck size={15} />
              <span className="mono">{chainIntact ? 'Chain intact' : 'Chain broken'}</span>
            </span>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                verifyLedger().then((r) => setVerified(r.ok));
              }}
            >
              Verify chain
            </button>
          </div>
        }
      />

      {verified !== null && (
        <div className={'verify-result mono' + (verified ? '' : ' is-broken')}>
          <IconCheck size={15} />
          {verified
            ? `Verified ${ledger.length} events · every prev_hash matches · chain intact`
            : 'Verification failed · a prev_hash does not match'}
        </div>
      )}

      <div className="toolbar">
        <input
          className="field__input search mono"
          placeholder="Search fingerprint, agent, reviewer, request…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search the ledger"
        />
        <span className="toolbar__count mono tnum">{rows.length} events</span>
      </div>

      <div className="table table--ledger" role="table" aria-label="Ledger events">
        <div className="table__head" role="row">
          <span role="columnheader" className="mono col-right">Seq</span>
          <span role="columnheader" className="mono">Timestamp</span>
          <span role="columnheader" className="mono">Actor</span>
          <span role="columnheader" className="mono">Event</span>
          <span role="columnheader" className="mono">Request</span>
          <span role="columnheader" className="mono">Payload hash</span>
        </div>
        {rows.map((e) => (
          <div key={e.seq} className="table__row" role="row">
            <span role="cell" className="mono tnum col-right">{e.seq}</span>
            <span role="cell" className="mono tnum">{e.ts.replace('T', ' ').replace('Z', 'Z')}</span>
            <span role="cell" className="mono">{e.actor}</span>
            <span role="cell" className="mono">{e.event}</span>
            <span role="cell" className="mono">{e.requestId ?? '—'}</span>
            <span role="cell" className="mono cell-wrap">{e.payloadHash}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="empty">No events match that search.</div>}
      </div>
    </div>
  );
}
