import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import type {
  ActionType,
  Agent,
  AgentRequest,
  LedgerEvent,
  Receipt,
} from '../data/types';
import {
  agents as seedAgents,
  actionTypes as seedActionTypes,
  requests as seedRequests,
  ledger as seedLedger,
  GENESIS_HASH,
} from '../data/seed';
import { fingerprintOf } from '../data/fingerprint';
import {
  isLive,
  liveLabel,
  fetchOverview,
  fetchInbox,
  fetchAgents,
  fetchActionTypes,
  fetchLedger,
  fetchLedgerVerify,
  decideRequest,
  mapAgent,
  mapActionType,
  mapRequest,
  mapLedgerList,
  type SrvOverview,
} from '../data/api';

interface State {
  agents: Agent[];
  actionTypes: ActionType[];
  requests: AgentRequest[];
  ledger: LedgerEvent[];
}

export interface DecisionInput {
  requestId: string;
  verdict: 'approved' | 'approved_with_edit' | 'rejected';
  reviewer: string;
  via: string;
  reason?: string;
  edits?: Record<string, string | number>;
  newFingerprint: string;
}

export interface VerifyResult {
  ok: boolean;
  events?: number;
  brokenSeq?: number;
}

type Action =
  | { type: 'DECIDE'; payload: DecisionInput }
  | { type: 'TOGGLE_AGENT'; payload: { agentId: string } };

function nextLedger(
  ledger: LedgerEvent[],
  actor: string,
  event: string,
  requestId: string,
  payloadHash: string,
): LedgerEvent {
  const last = ledger[ledger.length - 1];
  return {
    seq: last.seq + 1,
    ts: new Date().toISOString(),
    actor,
    event,
    requestId,
    payloadHash,
    prevHash: last.payloadHash,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'DECIDE': {
      const d = action.payload;
      const req = state.requests.find((r) => r.id === d.requestId);
      if (!req || req.status !== 'pending') return state;

      const receipt: Receipt = {
        fingerprint: d.newFingerprint,
        reviewer: d.reviewer,
        via: d.via,
        note: d.verdict === 'rejected' ? 'agent halted' : 'agent resumed',
      };

      const requests = state.requests.map((r) =>
        r.id === d.requestId
          ? {
              ...r,
              status: d.verdict,
              reason: d.reason,
              edits: d.edits,
              decidedBy: d.reviewer,
              decidedVia: d.via,
              decidedMinAgo: 0,
              receipt,
            }
          : r,
      );

      // decision.made, then decision.consumed for a resumed agent.
      let ledger = state.ledger;
      const decisionEvent = nextLedger(
        ledger,
        d.reviewer,
        'decision.made',
        d.requestId,
        d.newFingerprint,
      );
      ledger = [...ledger, decisionEvent];

      if (d.verdict !== 'rejected') {
        const consumed = nextLedger(
          ledger,
          req.agentId,
          'decision.consumed',
          d.requestId,
          fingerprintOf(`${d.newFingerprint}:consumed`),
        );
        ledger = [...ledger, consumed];
      }

      return { ...state, requests, ledger };
    }
    case 'TOGGLE_AGENT': {
      const agents = state.agents.map((a) =>
        a.id === action.payload.agentId ? { ...a, disabled: !a.disabled } : a,
      );
      return { ...state, agents };
    }
    default:
      return state;
  }
}

interface StoreValue extends State {
  overview: SrvOverview | null;
  isLive: boolean;
  endpointLabel: string;
  decide: (input: DecisionInput) => void | Promise<void>;
  toggleAgent: (agentId: string) => void;
  verifyLedger: () => Promise<VerifyResult>;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Client-side hash-chain check, used for seed mode and the passive badge. */
function verifyChainLocal(ledger: LedgerEvent[]): VerifyResult {
  let prev = GENESIS_HASH;
  for (const e of ledger) {
    if (e.prevHash !== prev) return { ok: false, brokenSeq: e.seq };
    prev = e.payloadHash;
  }
  return { ok: true, events: ledger.length };
}

function SeedProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    agents: seedAgents,
    actionTypes: seedActionTypes,
    requests: seedRequests,
    ledger: seedLedger,
  }));

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      overview: null,
      isLive: false,
      endpointLabel: 'Demo data · auth off',
      decide: (input) => dispatch({ type: 'DECIDE', payload: input }),
      toggleAgent: (agentId) =>
        dispatch({ type: 'TOGGLE_AGENT', payload: { agentId } }),
      verifyLedger: () => Promise.resolve(verifyChainLocal(state.ledger)),
    }),
    [state],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

const EMPTY: State = { agents: [], actionTypes: [], requests: [], ledger: [] };

function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [overview, setOverview] = useState<SrvOverview | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      const [ov, inbox, ag, at, led] = await Promise.all([
        fetchOverview(),
        fetchInbox(),
        fetchAgents(),
        fetchActionTypes(),
        fetchLedger(),
      ]);
      if (!mounted) return;
      setOverview(ov);
      setState({
        agents: ag.agents.map((a) => mapAgent(a, inbox.requests, at.action_types)),
        actionTypes: at.action_types.map(mapActionType),
        requests: inbox.requests.map(mapRequest),
        ledger: mapLedgerList(led.events),
      });
    }

    async function poll() {
      // Refresh the catalog alongside the inbox: an agent can register a new
      // action type after mount, and LiveRequestDetail needs its definition to
      // render (otherwise the request is stuck on "Loading request…").
      const [ov, inbox, ag, at, led] = await Promise.all([
        fetchOverview(),
        fetchInbox(),
        fetchAgents(),
        fetchActionTypes(),
        fetchLedger(),
      ]);
      if (!mounted) return;
      setOverview(ov);
      setState((prev) => ({
        ...prev,
        agents: ag.agents.map((a) => mapAgent(a, inbox.requests, at.action_types)),
        actionTypes: at.action_types.map(mapActionType),
        requests: inbox.requests.map(mapRequest),
        // Refresh the ledger too so decisions made elsewhere appear without a reload.
        ledger: mapLedgerList(led.events),
      }));
    }

    loadAll().catch((err) => console.error('fleetwrit: initial load failed', err));
    const iv = setInterval(() => {
      poll().catch((err) => console.error('fleetwrit: poll failed', err));
    }, 3000);

    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  const value = useMemo<StoreValue>(() => {
    const decide = async (input: DecisionInput) => {
      const req = state.requests.find((r) => r.id === input.requestId);
      const outcome: 'approved' | 'rejected' =
        input.verdict === 'rejected' ? 'rejected' : 'approved';
      let edits: Record<string, unknown> | undefined;
      if (input.verdict === 'approved_with_edit' && input.edits) {
        edits = {};
        for (const [k, v] of Object.entries(input.edits)) {
          const arg = req?.args.find((a) => a.key === k);
          if (arg?.hint === 'money') {
            // Money fields render major units in the UI; the server wants minor.
            edits[k] = Number(v) * 100;
          } else if (typeof arg?.raw === 'number') {
            // Numeric fields must stay numbers on the wire, and any presentational
            // prefix (e.g. the "v" on a version) must never reach an int field.
            edits[k] = Number(String(v).replace(/[^0-9.-]/g, ''));
          } else {
            edits[k] = v;
          }
        }
      }
      await decideRequest(input.requestId, { outcome, edits, reason: input.reason });
      const [ov, inbox, led] = await Promise.all([
        fetchOverview(),
        fetchInbox(),
        fetchLedger(),
      ]);
      setOverview(ov);
      setState((prev) => ({
        ...prev,
        requests: inbox.requests.map(mapRequest),
        ledger: mapLedgerList(led.events),
      }));
    };

    const toggleAgent = (agentId: string) =>
      setState((prev) => ({
        ...prev,
        agents: prev.agents.map((a) =>
          a.id === agentId ? { ...a, disabled: !a.disabled } : a,
        ),
      }));

    const verifyLedger = async (): Promise<VerifyResult> => {
      const r = await fetchLedgerVerify();
      return { ok: r.ok, events: r.events, brokenSeq: r.broken_seq };
    };

    return {
      ...state,
      overview,
      isLive: true,
      endpointLabel: liveLabel(),
      decide,
      toggleAgent,
      verifyLedger,
    };
  }, [state, overview]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  return isLive ? (
    <LiveProvider>{children}</LiveProvider>
  ) : (
    <SeedProvider>{children}</SeedProvider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

// ---- selectors / helpers ----
export function useActionType(type: string): ActionType | undefined {
  const { actionTypes } = useStore();
  return actionTypes.find((a) => a.type === type);
}

export function useAgent(id: string): Agent | undefined {
  const { agents } = useStore();
  return agents.find((a) => a.id === id);
}
