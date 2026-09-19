export type Risk = 'critical' | 'high' | 'medium' | 'low';

export type Environment = 'prod' | 'staging';

export type RequestStatus =
  | 'pending'
  | 'approved'
  | 'approved_with_edit'
  | 'rejected'
  | 'expired';

export type ArgHint = 'money' | 'version' | 'count' | 'text' | 'id';

export interface ActionArg {
  key: string;
  label: string;
  value: string | number;
  hint: ArgHint;
  /** for version bumps: the target value, e.g. v41 -> v42 */
  to?: string | number;
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
