/** The JSON the contract's views return. Field names are the contract's own. */

export type Mode = 'SECRET' | 'ACTION' | 'SCOPE';
export type Kind = 'secret' | 'action' | 'scope';

export type Rule = {
  number: number;
  kind: Kind;
  text: string;
  /** How it is checked: "canary match", "JSON action" or "judge prompt". */
  check: string;
  max_amount?: string;
  allowlist?: string[];
  unit?: string;
};

export type TargetStatus = 'OPEN' | 'BROKEN' | 'CLOSED';

export type Target = {
  id: number;
  name: string;
  builder: string;
  instructions: string;
  mode: Mode;
  rules: Rule[];
  entry_fee: string;
  created_at: number;
  lock_until: number;
  posted: string;
  topups: number;
  fees_in: string;
  bounty: string;
  escrow: string;
  status: TargetStatus;
  attacks: number;
  queued: number;
  held: number;
  rejected: number;
  void: number;
  broken: number;
  winner: string;
  winning_attack: number;
  broken_rule: number;
  broken_at: number;
  paid: boolean;
  paid_at: number;
};

export type AttackStatus = 'QUEUED' | 'HELD' | 'BROKEN' | 'REJECTED' | 'VOID';

export type Attack = {
  id: number;
  target_id: number;
  target_name: string;
  target_mode: Mode;
  number: number;
  hunter: string;
  text: string;
  fee: string;
  submitted_at: number;
  status: AttackStatus;
  /** HELD, BROKEN:<rule>, REJECTED or VOID. Empty while queued. */
  verdict: string;
  rule: number;
  /** The leader's reply, cut to 400 characters, the canary stored as {CANARY}. */
  reply: string;
  reason: string;
  judged_at: number;
  judged_by: string;
  refunded: boolean;
  refundable: boolean;
};

export type TargetPage = { status: string; total: number; offset: number; items: Target[] };
export type AttackPage = { target_id: number; total: number; offset: number; items: Attack[] };
export type NotFound = { found: false };
