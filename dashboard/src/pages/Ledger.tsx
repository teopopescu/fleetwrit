import { Fragment, useMemo, useState } from 'react';
import { useStore, type VerifyResult } from '../store/store';
import { PageHead } from '../components/PageHead';
import { Stamp } from '../components/Stamp';
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
  const [verified, setVerified] = useState<VerifyResult | null>(null);
  const [open, setOpen] = useState<number | null>(null);

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
        lede="Append-only record of every event. Each entry chains to the previous by hash. Select a row for its full detail."
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
                verifyLedger().then(setVerified);
              }}
            >
              Verify chain
            </button>
          </div>
        }
      />

      {verified !== null && (
        <div>
          <Stamp variant={verified.ok ? 'stamp--green' : 'stamp--red'}>
            {verified.ok
              ? `chain intact · ${verified.events ?? ledger.length} events`
              : `broken at seq ${verified.brokenSeq ?? '?'}`}
          </Stamp>
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
        {rows.map((e) => {
          const isOpen = open === e.seq;
          return (
            <Fragment key={e.seq}>
              <button
                type="button"
                className="table__row table__row--btn"
                role="row"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : e.seq)}
              >
                <span role="cell" className="mono tnum col-right">{e.seq}</span>
                <span role="cell" className="mono tnum">{e.ts.replace('T', ' ')}</span>
                <span role="cell" className="mono">{e.actor}</span>
                <span role="cell" className="mono">{e.event}</span>
                <span role="cell" className="mono">{e.requestId ?? '—'}</span>
                <span role="cell" className="mono cell-wrap">{e.payloadHash}</span>
              </button>
              {isOpen && (
                <div className="table__detail">
                  <dl className="args">
                    <div className="args__row">
                      <dt className="args__key mono">Seq</dt>
                      <dd className="args__val mono">{e.seq}</dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Timestamp</dt>
                      <dd className="args__val mono">{e.ts}</dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Actor</dt>
                      <dd className="args__val mono">{e.actor}</dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Event</dt>
                      <dd className="args__val mono">{e.event}</dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Request</dt>
                      <dd className="args__val mono">{e.requestId ?? '—'}</dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Payload hash</dt>
                      <dd className="args__val mono">{e.payloadHash}</dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Prev hash</dt>
                      <dd className="args__val mono">{e.prevHash}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </Fragment>
          );
        })}
        {rows.length === 0 && ledger.length === 0 && (
          <div className="empty">
            No ledger events yet.
            <span className="empty__hint mono">
              Run an agent against this server, or start with <code>fleetwrit dev --demo</code>.
            </span>
          </div>
        )}
        {rows.length === 0 && ledger.length > 0 && (
          <div className="empty">No events match that search.</div>
        )}
      </div>
    </div>
  );
}
