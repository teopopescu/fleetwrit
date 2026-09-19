export type Risk = 'critical' | 'high' | 'medium' | 'low';

// The server may report any environment string (e.g. "dev", "prod", "staging").
// The known values are listed for autocompletion; any other value survives too.
export type Environment = 'prod' | 'staging' | 'dev' | (string & {});

export type RequestStatus =
  | 'pending'
  | 'approved'
  | 'approved_with_edit'
  | 'rejected'
  | 'expired';

export type ArgHint = 'money' | 'version' | 'count' | 'text' | 'id' | 'json';

export interface ActionArg {
  key: string;
  label: string;
  value: string | number;
  hint: ArgHint;
  /** for version bumps: the target value, e.g. v41 -> v42 */
  to?: string | number;
  /**
   * The underlying, unformatted argument value. Kept separate from `value`
   * (which may carry presentational formatting such as a "v" prefix or a
   * pretty-printed JSON string) so reviewer edits serialize with the real type.
   */
  raw?: unknown;
  /** ISO currency code for money args, from the display hint's currency_field sibling. */
  currency?: string;
}

export interface Agent {
  id: string;
  environment: Environment;
  runtime: string;
  sdkVersion: string;
  lastSeen: string;
  owner: string;
  actionTypes: string[];
  volume30d: number;
  disabled: boolean;
  /** an undeclared action type observed in traffic but never registered */
  undeclaredActionType?: string;
}

export interface ActionType {
  type: string;
  title: string;
  risk: Risk;
  reversible: boolean;
  /** which arg keys a reviewer may edit on approve-with-edits */
  editable: string[];
  queue: string;
  owner: string;
  /** approval rate as a fraction 0..1 */
  approvalRate: number;
  versions: string;
  undeclared?: boolean;
}

export interface Provenance {
  runId: string;
  traceId: string;
}

export interface Receipt {
  fingerprint: string;
  reviewer: string;
  via: string;
  note: string;
}

export interface AgentRequest {
  id: string;
  agentId: string;
  actionType: string;
  title: string;
  summary: string;
  args: ActionArg[];
  risk: Risk;
  queue: string;
  status: RequestStatus;
  createdMinAgo: number;
  expiresInMin: number;
  fingerprint: string;
  policy: string;
  contextTicket: string;
  provenance: Provenance;
  /**
   * Safeguard metadata captured on the request snapshot at creation time.
   * Used in preference to the live catalog so re-registering an action type
   * while a request is pending cannot change its confirm/edit affordances.
   */
  reversible?: boolean;
  editable?: string[];
  /** decision fields, present once decided */
  reason?: string;
  edits?: Record<string, string | number>;
  decidedBy?: string;
  decidedVia?: string;
  decidedMinAgo?: number;
  receipt?: Receipt;
}

export interface LedgerEvent {
  seq: number;
  ts: string;
  actor: string;
  event: string;
  requestId?: string;
  payloadHash: string;
  prevHash: string;
}
