// Typed client + mappers for the Fleetwrit live server (see README "Live mode").
// Server /v1 wire shapes are mapped onto the internal model in src/data/types.ts
// so pages never change. Active only when VITE_FLEETWRIT_URL is set.

import type {
  ActionArg,
  ActionType,
  Agent,
  AgentRequest,
  ArgHint,
  Environment,
  LedgerEvent,
  Receipt,
  RequestStatus,
  Risk,
} from './types';
import { GENESIS_HASH } from './seed';
import { minsLabel } from '../lib/format';

// ---- config ---------------------------------------------------------------

export const FLEETWRIT_URL: string | undefined = import.meta.env.VITE_FLEETWRIT_URL;
export const isLive: boolean = Boolean(FLEETWRIT_URL);

/** Short label for the connection chip, e.g. "Live · localhost:4100". */
export function liveLabel(): string {
  if (!FLEETWRIT_URL) return '';
  try {
    return `Live · ${new URL(FLEETWRIT_URL).host}`;
  } catch {
    return 'Live';
  }
}

function base(): string {
  if (!FLEETWRIT_URL) throw new Error('VITE_FLEETWRIT_URL is not set');
  return FLEETWRIT_URL.replace(/\/$/, '');
}

const POLICY = 'OPA · ask';

// ---- server (wire) shapes -------------------------------------------------

interface DisplayHint {
  kind?: string;
  currency_field?: string;
}

export interface SrvOverview {
  pending: number;
  pending_high: number;
  pending_by_queue: Record<string, number>;
  oldest: string | null;
  decisions_total: number;
  approved: number;
  expired: number;
  undeclared: number;
  agents_by_runtime: Record<string, number>;
  chain: { ok: boolean; events?: number; broken_seq?: number };
}

export interface SrvAgent {
  agent_id: string;
  environment: string;
  version: string | null;
  runtime: string | null;
  owner: string | null;
  last_seen: string;
  disabled: boolean;
  volume30d: number;
}

export interface SrvActionType {
  type: string;
  version: string | null;
  title: string;
  risk: string;
  reversible: boolean;
  editable: string[];
  queue: string | null;
  owner: string | null;
  summary: string | null;
  undeclared: boolean;
  approval_rate: number | null;
}

export interface SrvReviewer {
  subject?: string;
  email?: string;
  name?: string;
  issuer?: string;
}

export interface SrvDecision {
  outcome: string;
  final_args?: Record<string, unknown>;
  original_fingerprint?: string;
  final_fingerprint?: string;
  reason: string | null;
  reviewer: SrvReviewer | null;
  receipt: string | null;
  decided_at?: string;
  consumed_at?: string | null;
}

export interface SrvReq {
  id: string;
  kind: string;
  agent_id: string;
  environment: string;
  type: string;
  action_version: string | null;
  tool: string | null;
  args: Record<string, unknown>;
  reversible: boolean;
  fingerprint: string;
  summary: string | null;
  context: Record<string, unknown>;
  queue: string | null;
  provenance: { run_id?: string; trace_id?: string | null } & Record<string, unknown>;
  risk: string;
  editable: string[];
  title: string;
  display: Record<string, DisplayHint>;
  created_at: string | null;
  expires_at: string | null;
  on_expiry: string;
  state: string;
  viewed_at: string | null;
  decision?: SrvDecision;
}

export interface SrvLedgerEvent {
  seq: number;
  ts: string;
  actor: string;
  event: string;
  payload_hash: string;
  refs: string;
  prev_hash: string;
  hash: string;
}

export interface SrvVerify {
  ok: boolean;
  events?: number;
  broken_seq?: number;
}

/** Body for POST /v1/requests/{id}/decide. */
export interface DecideBody {
  outcome: 'approved' | 'rejected';
  edits?: Record<string, unknown>;
  reason?: string;
}

// ---- transport ------------------------------------------------------------

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// ---- endpoint functions ---------------------------------------------------

export const fetchOverview = (): Promise<SrvOverview> => getJson('/v1/overview');
export const fetchInbox = (): Promise<{ requests: SrvReq[] }> => getJson('/v1/inbox');
export const fetchRequest = (id: string): Promise<SrvReq> => getJson(`/v1/requests/${id}`);
export const fetchAgents = (): Promise<{ agents: SrvAgent[] }> => getJson('/v1/agents');
export const fetchActionTypes = (): Promise<{ action_types: SrvActionType[] }> =>
  getJson('/v1/action-types');
export const fetchLedger = (): Promise<{ events: SrvLedgerEvent[] }> => getJson('/v1/ledger');
export const fetchLedgerVerify = (): Promise<SrvVerify> => getJson('/v1/ledger/verify');
export const decideRequest = (id: string, body: DecideBody): Promise<SrvDecision> =>
  postJson(`/v1/requests/${id}/decide`, body);

// ---- helpers --------------------------------------------------------------

const RISKS: Risk[] = ['critical', 'high', 'medium', 'low'];

function asRisk(r: string): Risk {
  return (RISKS as string[]).includes(r) ? (r as Risk) : 'medium';
}

function humanize(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function isMoneyKey(key: string, display: Record<string, DisplayHint> | undefined): boolean {
  return display?.[key]?.kind === 'money' || key === 'amount';
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  return mins < 1 ? 'now' : minsLabel(mins);
}

function minsSince(iso: string | null): number {
  if (!iso) return 0;
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.round((Date.now() - then) / 60000));
}

function minsUntil(iso: string | null): number {
  if (!iso) return 0;
  const when = Date.parse(iso);
  if (Number.isNaN(when)) return 0;
  return Math.max(0, Math.round((when - Date.now()) / 60000));
}

function mapStatus(state: string): RequestStatus {
  switch (state) {
    case 'approved':
      return 'approved';
    case 'approved_with_edits':
      return 'approved_with_edit';
    case 'rejected':
      return 'rejected';
    case 'expired':
    case 'cancelled':
      return 'expired';
    default:
      return 'pending';
  }
}

function viaLabel(issuer: string | undefined): string {
  if (!issuer) return '—';
  if (/okta/i.test(issuer)) return 'Okta';
  return issuer.replace(/^https?:\/\//, '');
}

function contextTicket(ctx: Record<string, unknown>): string {
  const preferred = ctx.ticket ?? ctx.alert ?? ctx.policy;
  if (preferred != null) return String(preferred);
  const first = Object.values(ctx)[0];
  return first != null ? String(first) : '—';
}

// Server money values are minor units (pence); the UI renders major units.
function mapArg(key: string, raw: unknown, display: Record<string, DisplayHint>): ActionArg {
  const label = humanize(key);
  if (isMoneyKey(key, display)) {
    const n = typeof raw === 'number' ? raw : Number(raw);
    return { key, label, value: Number.isFinite(n) ? n / 100 : String(raw), hint: 'money' };
  }
  if (key === 'version') {
    return { key, label, value: `v${String(raw)}`, hint: 'text' };
  }
  let hint: ArgHint = 'text';
  if (key === 'count' || key === 'records') hint = 'count';
  else if (key === 'charge' || key === 'supplier' || key === 'id') hint = 'id';
  const value = typeof raw === 'number' ? raw : String(raw);
  return { key, label, value, hint };
}

function mapArgs(args: Record<string, unknown>, display: Record<string, DisplayHint>): ActionArg[] {
  return Object.entries(args).map(([key, raw]) => mapArg(key, raw, display));
}

function mapEdits(req: SrvReq, decision: SrvDecision): Record<string, string | number> | undefined {
  const finalArgs = decision.final_args;
  if (!finalArgs) return undefined;
  const out: Record<string, string | number> = {};
  for (const key of req.editable) {
    if (!(key in finalArgs)) continue;
    const after = finalArgs[key];
    if (String(req.args[key]) === String(after)) continue;
    if (isMoneyKey(key, req.display)) {
      const n = typeof after === 'number' ? after : Number(after);
      out[key] = Number.isFinite(n) ? n / 100 : String(after);
    } else {
      out[key] = typeof after === 'number' ? after : String(after);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

// ---- mappers --------------------------------------------------------------

export function mapAgent(a: SrvAgent, requests: SrvReq[], actionTypes: SrvActionType[]): Agent {
  const undeclaredSet = new Set(actionTypes.filter((t) => t.undeclared).map((t) => t.type));
  const mine = requests.filter((r) => r.agent_id === a.agent_id);
  const declared = Array.from(new Set(mine.map((r) => r.type).filter((t) => !undeclaredSet.has(t))));
  const undeclaredType = mine.map((r) => r.type).find((t) => undeclaredSet.has(t));

  const environment: Environment = a.environment === 'staging' ? 'staging' : 'prod';
  const agent: Agent = {
    id: a.agent_id,
    environment,
    runtime: a.runtime ?? 'unknown',
    sdkVersion: a.version ? (a.version.startsWith('v') ? a.version : `v${a.version}`) : '—',
    lastSeen: relTime(a.last_seen),
    owner: a.owner ?? 'unassigned',
    actionTypes: declared,
    volume30d: a.volume30d ?? 0,
    disabled: a.disabled,
  };
  if (undeclaredType) agent.undeclaredActionType = undeclaredType;
  return agent;
}

export function mapActionType(t: SrvActionType): ActionType {
  return {
    type: t.type,
    title: t.title,
    risk: asRisk(t.risk),
    reversible: t.reversible,
    editable: t.editable ?? [],
    queue: t.queue ?? '—',
    owner: t.owner ?? 'unassigned',
    approvalRate: t.approval_rate ?? 0,
    versions: t.undeclared ? '—' : t.version ?? '—',
    undeclared: t.undeclared,
  };
}

export function mapRequest(r: SrvReq): AgentRequest {
  const req: AgentRequest = {
    id: r.id,
    agentId: r.agent_id,
    actionType: r.type,
    title: r.title,
    summary: r.summary ?? '',
    args: mapArgs(r.args ?? {}, r.display ?? {}),
    risk: asRisk(r.risk),
    queue: r.queue ?? '—',
    status: mapStatus(r.state),
    createdMinAgo: minsSince(r.created_at),
    expiresInMin: minsUntil(r.expires_at),
    fingerprint: r.fingerprint,
    policy: POLICY,
    contextTicket: contextTicket(r.context ?? {}),
    provenance: {
      runId: r.provenance?.run_id ? String(r.provenance.run_id) : '—',
      traceId: r.provenance?.trace_id ? String(r.provenance.trace_id) : '—',
    },
  };

  const d = r.decision;
  if (d) {
    if (d.reason) req.reason = d.reason;
    const edits = mapEdits(r, d);
    if (edits) req.edits = edits;
    req.decidedBy = d.reviewer?.email ?? d.reviewer?.name ?? '—';
    req.decidedVia = viaLabel(d.reviewer?.issuer);
    req.decidedMinAgo = d.decided_at ? minsSince(d.decided_at) : 0;
    const receipt: Receipt = {
      fingerprint: d.final_fingerprint ?? r.fingerprint,
      reviewer: d.reviewer?.email ?? '—',
      via: viaLabel(d.reviewer?.issuer),
      note: d.outcome === 'rejected' ? 'agent halted' : 'agent resumed',
    };
    req.receipt = receipt;
  }
  return req;
}

// Oldest-first so the client chain check reads in order. Server chains each
// row's `hash` off the previous `hash`, surfaced here as `payloadHash`; the
// genesis sentinel is rewritten so the client verifier stays intact in live mode.
export function mapLedgerList(events: SrvLedgerEvent[]): LedgerEvent[] {
  const ascending = [...events].sort((a, b) => a.seq - b.seq);
  return ascending.map((e) => {
    let requestId: string | undefined;
    try {
      const refs = JSON.parse(e.refs || '{}') as { request?: string };
      if (refs.request) requestId = refs.request;
    } catch {
      requestId = undefined;
    }
    const event: LedgerEvent = {
      seq: e.seq,
      ts: e.ts,
      actor: e.actor,
      event: e.event,
      payloadHash: e.hash,
      prevHash: e.prev_hash === 'genesis' ? GENESIS_HASH : e.prev_hash,
    };
    if (requestId) event.requestId = requestId;
    return event;
  });
}
