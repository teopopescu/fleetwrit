import type { Risk } from '../data/types';

/** A currency symbol for known codes, else the upper-cased code itself. */
export function currencySymbol(currency: string | undefined = 'GBP'): string {
  const code = (currency || 'GBP').toUpperCase();
  return code === 'GBP' ? '£' : code === 'USD' ? '$' : code === 'EUR' ? '€' : code;
}

export function money(value: number | string, currency: string | undefined = 'GBP'): string {
  const n = typeof value === 'string' ? Number(value) : value;
  const sym = currencySymbol(currency);
  // Single-char symbols hug the number; multi-char codes get a trailing space.
  const prefix = sym.length === 1 ? sym : `${sym} `;
  return `${prefix}${n.toLocaleString('en-GB')}`;
}

export function riskStampClass(risk: Risk): string {
  switch (risk) {
    case 'critical':
      return 'stamp--red';
    case 'high':
      return 'stamp--amber';
    case 'medium':
      return 'stamp--accent';
    case 'low':
      return 'stamp--muted';
  }
}

export function verdictStampClass(status: string): string {
  switch (status) {
    case 'approved':
    case 'approved_with_edit':
      return 'stamp--green';
    case 'rejected':
      return 'stamp--red';
    case 'expired':
      return 'stamp--muted';
    case 'pending':
      return 'stamp--amber';
    default:
      return 'stamp--muted';
  }
}

export function statusLabel(status: string): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'approved_with_edit':
      return 'Approved · edited';
    case 'rejected':
      return 'Rejected';
    case 'expired':
      return 'Expired';
    case 'pending':
      return 'Pending';
    default:
      return status;
  }
}

export function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function minsLabel(mins: number): string {
  if (mins <= 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
