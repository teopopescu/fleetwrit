import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStore, type DecisionInput } from '../store/store';
import { fetchRequest, mapRequest } from '../data/api';
import { RiskStamp, StatusStamp, Stamp } from '../components/Stamp';
import {
  IconArrowRight,
  IconCheck,
  IconEdit,
  IconSeal,
  IconX,
} from '../components/Icons';
import { fingerprintOf } from '../data/fingerprint';
import { money, minsLabel } from '../lib/format';
import type { ActionArg, ActionType, AgentRequest } from '../data/types';

const REVIEWER = 'you@acme.com';
const VIA = 'Okta (demo)';

const CONFIRM_PHRASE: Record<string, string> = {
  'deploy.rollback': 'ROLL BACK',
  'data.delete': 'DELETE',
  'refund.issue': 'REFUND',
  'payment.release': 'RELEASE',
};

function confirmPhrase(actionType: string): string {
  return CONFIRM_PHRASE[actionType] ?? actionType.split('.')[1]?.toUpperCase() ?? 'CONFIRM';
}

function ArgValue({ arg, edited }: { arg: ActionArg; edited?: string | number }) {
  if (arg.hint === 'money') {
    if (edited !== undefined && String(edited) !== String(arg.value)) {
      return (
        <span className="mono tnum">
          <span className="strike">{money(arg.value)}</span>
          <IconArrowRight size={14} className="inline-arrow" />
          <span className="edited">{money(edited)}</span>
        </span>
      );
    }
    return <span className="mono tnum">{money(arg.value)}</span>;
  }
  if (arg.hint === 'version') {
    const to = edited !== undefined ? edited : arg.to;
    return (
      <span className="mono tnum">
        {String(arg.value)}
        <IconArrowRight size={14} className="inline-arrow" />
        <span className={edited !== undefined && String(edited) !== String(arg.to) ? 'edited' : ''}>
          {String(to)}
        </span>
      </span>
    );
  }
  if (arg.hint === 'count') {
    return <span className="mono tnum">{Number(arg.value).toLocaleString('en-GB')}</span>;
  }
  return <span className="mono">{String(arg.value)}</span>;
}

function NotFoundBlock({ message }: { message: string }) {
  return (
    <div className="page">
      <p>{message}</p>
      <Link to="/inbox" className="panel__more">
        Back to inbox <IconArrowRight size={15} />
      </Link>
    </div>
  );
}

export function RequestDetail() {
  const store = useStore();
  return store.isLive ? <LiveRequestDetail /> : <SeedRequestDetail />;
}

function SeedRequestDetail() {
  const { id } = useParams();
  const { requests, decide, actionTypes } = useStore();
  const req = requests.find((r) => r.id === id);
  const action = actionTypes.find((a) => a.type === req?.actionType);

  if (!req || !action) return <NotFoundBlock message="Request not found." />;

  return (
    <RequestDetailBody key={req.id} req={req} action={action} decide={decide} requests={requests} />
  );
}

function LiveRequestDetail() {
  const { id } = useParams();
  const { actionTypes, requests, decide } = useStore();
  const [req, setReq] = useState<AgentRequest | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    fetchRequest(id)
      .then((r) => {
        if (mounted) setReq(mapRequest(r));
      })
      .catch(() => {
        if (mounted) setNotFound(true);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const action = actionTypes.find((a) => a.type === req?.actionType);

  if (notFound) return <NotFoundBlock message="Request not found." />;
  if (!req || !action) return <NotFoundBlock message="Loading request…" />;

  const liveDecide = async (input: DecisionInput) => {
    const result = decide(input);
    if (result) await result;
    if (!id) return;
    const fresh = await fetchRequest(id);
    setReq(mapRequest(fresh));
  };

  return (
    <RequestDetailBody key={req.id} req={req} action={action} decide={liveDecide} requests={requests} />
  );
}

function RequestDetailBody({
  req,
  action,
  decide,
  requests,
}: {
  req: AgentRequest;
  action: ActionType;
  decide: ReturnType<typeof useStore>['decide'];
  requests: AgentRequest[];
}) {
  type Mode = 'approve' | 'edit' | 'reject' | null;
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [edits, setEdits] = useState<Record<string, string | number>>({});
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');

  const needsConfirm = !action.reversible || req.risk === 'critical';
  const phrase = confirmPhrase(action.type);
  const decided = req.status !== 'pending';

  const editableArgs = action.editable
    .map((k) => req.args.find((a) => a.key === k))
    .filter((a): a is ActionArg => Boolean(a));

  // Live fingerprint for the pending decision.
  const newFingerprint = useMemo(() => {
    const verdict = mode === 'edit' ? 'approved_with_edit' : mode ?? 'preview';
    return fingerprintOf(
      `${req.id}:${verdict}:${JSON.stringify(edits)}:${REVIEWER}`,
    );
  }, [req.id, mode, edits]);

  const priorDecisions = requests.filter(
    (r) => r.actionType === req.actionType && r.status !== 'pending' && r.id !== req.id,
  );

  function editValueFor(arg: ActionArg): string {
    if (arg.key in edits) return String(edits[arg.key]);
    return String(arg.hint === 'version' ? (arg.to ?? arg.value) : arg.value);
  }

  function submit() {
    setError('');
    if ((mode === 'reject' || mode === 'edit') && reason.trim().length < 4) {
      setError('A reason is required.');
      return;
    }
    if (mode !== 'reject' && needsConfirm && confirmText.trim() !== phrase) {
      setError(`Type "${phrase}" exactly to confirm this irreversible action.`);
      return;
    }
    const verdict =
      mode === 'edit' ? 'approved_with_edit' : mode === 'reject' ? 'rejected' : 'approved';
    decide({
      requestId: req.id,
      verdict,
      reviewer: REVIEWER,
      via: VIA,
      reason: reason.trim() || undefined,
      edits: mode === 'edit' ? edits : undefined,
      newFingerprint,
    });
  }

  return (
    <div className="page">
      <Link to="/inbox" className="backlink">
        <IconArrowRight size={15} className="flip" /> Inbox
      </Link>

      <header className="detailhead">
        <div className="detailhead__rule mono">
          <span className="pagehead__no">{req.id}</span>
          <span className="pagehead__file">{req.actionType}</span>
        </div>
        <div className="detailhead__row">
          <h1 className="detailhead__title">{req.title}</h1>
          <div className="detailhead__stamps">
            <RiskStamp risk={req.risk} />
            <StatusStamp status={req.status} />
          </div>
        </div>
        <div className="detailhead__meta mono">
          <span>{req.agentId}</span>
          <span className="dot">·</span>
          <span>{req.queue}</span>
          <span className="dot">·</span>
          <span>{req.policy}</span>
          {!decided && (
            <>
              <span className="dot">·</span>
              <span>expires {minsLabel(req.expiresInMin)}</span>
            </>
          )}
        </div>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel">
            <h2 className="panel__h">Summary</h2>
            <p className="panel__body">{req.summary}</p>
          </section>

          <section className="panel">
            <h2 className="panel__h">Action arguments</h2>
            <dl className="args">
              {req.args.map((arg) => (
                <div className="args__row" key={arg.key}>
                  <dt className="args__key mono">{arg.label}</dt>
                  <dd className="args__val">
                    <ArgValue
                      arg={arg}
                      edited={
                        req.edits?.[arg.key] ??
                        (mode === 'edit' ? edits[arg.key] : undefined)
                      }
                    />
                    {action.editable.includes(arg.key) && !decided && (
                      <span className="args__editable mono">editable</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid-2">
            <section className="panel">
              <h2 className="panel__h">Context</h2>
              <dl className="args">
                <div className="args__row">
                  <dt className="args__key mono">Ticket</dt>
                  <dd className="args__val mono">{req.contextTicket}</dd>
                </div>
                <div className="args__row">
                  <dt className="args__key mono">Opened</dt>
                  <dd className="args__val mono tnum">{minsLabel(req.createdMinAgo)} ago</dd>
                </div>
              </dl>
            </section>
            <section className="panel">
              <h2 className="panel__h">Provenance</h2>
              <dl className="args">
                <div className="args__row">
                  <dt className="args__key mono">run_id</dt>
                  <dd className="args__val mono">{req.provenance.runId}</dd>
                </div>
                <div className="args__row">
                  <dt className="args__key mono">trace_id</dt>
                  <dd className="args__val mono">{req.provenance.traceId}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="panel">
            <h2 className="panel__h">Policy verdict</h2>
            <div className="verdict">
              <Stamp variant="stamp--amber">{req.policy}</Stamp>
              <p className="verdict__text">
                Policy <span className="mono">{action.type}</span> matched rule{' '}
                <span className="mono">require_human_review</span> — this action is gated on a
                reviewer decision before the agent may proceed.
              </p>
            </div>
            <div className="fingerprint">
              <span className="fingerprint__label mono">Request fingerprint</span>
              <span className="fingerprint__value mono">{req.fingerprint}</span>
            </div>
          </section>

          <section className="panel">
            <h2 className="panel__h">
              Prior decisions on <span className="mono">{req.actionType}</span>
            </h2>
            {priorDecisions.length === 0 ? (
              <p className="panel__body muted">No prior decisions recorded.</p>
            ) : (
              <ul className="prior">
                {priorDecisions.map((p) => (
                  <li key={p.id} className="prior__row">
                    <StatusStamp status={p.status} />
                    <span className="prior__title">{p.title}</span>
                    <span className="prior__by mono">
                      {p.decidedBy ?? 'system'}
                      {p.decidedMinAgo !== undefined ? ` · ${minsLabel(p.decidedMinAgo)} ago` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="detail-side">
          {decided ? (
            <DecisionReceipt req={req} />
          ) : (
            <div className="decision">
              <h2 className="panel__h">Decision</h2>
              <div className="decision__modes">
                <button
                  type="button"
                  className={'decision__mode' + (mode === 'approve' ? ' is-active' : '')}
                  onClick={() => { setMode('approve'); setError(''); }}
                >
                  <IconCheck size={16} /> Approve
                </button>
                {action.editable.length > 0 && (
                  <button
                    type="button"
                    className={'decision__mode' + (mode === 'edit' ? ' is-active' : '')}
                    onClick={() => { setMode('edit'); setError(''); }}
                  >
                    <IconEdit size={16} /> Approve with edits
                  </button>
                )}
                <button
                  type="button"
                  className={'decision__mode decision__mode--reject' + (mode === 'reject' ? ' is-active' : '')}
                  onClick={() => { setMode('reject'); setError(''); }}
                >
                  <IconX size={16} /> Reject
                </button>
              </div>

              {mode === 'edit' && (
                <div className="decision__fields">
                  {editableArgs.map((arg) => (
                    <label key={arg.key} className="field">
                      <span className="field__label mono">
                        {arg.label}
                        {arg.hint === 'money' ? ' (£)' : arg.hint === 'version' ? ' (target)' : ''}
                      </span>
                      <input
                        className="field__input mono"
                        value={editValueFor(arg)}
                        inputMode={arg.hint === 'money' ? 'numeric' : 'text'}
                        onChange={(e) =>
                          setEdits((prev) => ({
                            ...prev,
                            [arg.key]:
                              arg.hint === 'money'
                                ? Number(e.target.value.replace(/[^0-9.]/g, '')) || 0
                                : e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                  <p className="field__hint mono">
                    Only {action.editable.join(', ')} may be edited on this action type.
                  </p>
                </div>
              )}

              {(mode === 'edit' || mode === 'reject') && (
                <label className="field">
                  <span className="field__label mono">
                    Reason {mode === 'reject' ? '(required)' : '(required)'}
                  </span>
                  <textarea
                    className="field__input"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      mode === 'reject'
                        ? 'Why this request is being rejected…'
                        : 'Why this edit is being applied…'
                    }
                  />
                </label>
              )}

              {mode && mode !== 'reject' && (
                <div className="fingerprint fingerprint--new">
                  <span className="fingerprint__label mono">New fingerprint</span>
                  <span className="fingerprint__value mono">{newFingerprint}</span>
                </div>
              )}

              {mode && mode !== 'reject' && needsConfirm && (
                <label className="field field--confirm">
                  <span className="field__label mono">
                    Type <span className="phrase">{phrase}</span> to confirm
                  </span>
                  <input
                    className="field__input mono"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={phrase}
                    aria-label={`Type ${phrase} to confirm`}
                  />
                </label>
              )}

              {error && <p className="decision__error mono">{error}</p>}

              {mode && (
                <button
                  type="button"
                  className={
                    'btn decision__submit' + (mode === 'reject' ? ' btn--reject' : '')
                  }
                  onClick={submit}
                >
                  {mode === 'reject'
                    ? 'Reject request'
                    : mode === 'edit'
                      ? 'Approve with edits'
                      : 'Approve request'}
                </button>
              )}
              {!mode && (
                <p className="decision__prompt mono">
                  Choose a verdict. This is recorded to the ledger and resumes or halts the agent.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function DecisionReceipt({ req }: { req: AgentRequest }) {
  const receipt = req.receipt;
  const approved = req.status === 'approved' || req.status === 'approved_with_edit';
  return (
    <div className={'receipt' + (approved ? ' receipt--ok' : ' receipt--halt')}>
      <div className="receipt__seal" aria-hidden>
        <IconSeal size={44} />
      </div>
      <div className="receipt__title mono">
        {req.status === 'rejected'
          ? 'Rejected'
          : req.status === 'expired'
            ? 'Expired'
            : 'Certificate of authorisation'}
      </div>
      <StatusStamp status={req.status} />
      <dl className="receipt__lines">
        <div className="receipt__line">
          <dt className="mono">fingerprint</dt>
          <dd className="mono">{req.receipt?.fingerprint ?? req.fingerprint}</dd>
        </div>
        <div className="receipt__line">
          <dt className="mono">reviewer</dt>
          <dd className="mono">{req.decidedBy ?? '—'}</dd>
        </div>
        <div className="receipt__line">
          <dt className="mono">via</dt>
          <dd className="mono">{req.decidedVia ?? '—'}</dd>
        </div>
        {req.edits && (
          <div className="receipt__line">
            <dt className="mono">edit</dt>
            <dd className="mono">
              {Object.entries(req.edits)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')}
            </dd>
          </div>
        )}
        {req.reason && (
          <div className="receipt__line">
            <dt className="mono">reason</dt>
            <dd className="receipt__reason">{req.reason}</dd>
          </div>
        )}
      </dl>
      {receipt && (
        <p className="receipt__signed mono">
          Signed · {receipt.reviewer} · {receipt.note}
        </p>
      )}
      <p className="receipt__note mono">
        A <span className="mono">decision.made</span> event was appended to the ledger.
      </p>
      <Link to="/ledger" className="panel__more">
        View in ledger <IconArrowRight size={15} />
      </Link>
    </div>
  );
}
