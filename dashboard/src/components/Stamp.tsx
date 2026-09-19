import type { Risk } from '../data/types';
import { riskStampClass, verdictStampClass, statusLabel } from '../lib/format';

export function Stamp({
  variant,
  children,
}: {
  variant: string;
  children: React.ReactNode;
}) {
  return <span className={`stamp ${variant}`}>{children}</span>;
}

export function RiskStamp({ risk }: { risk: Risk }) {
  return <span className={`stamp ${riskStampClass(risk)}`}>{risk}</span>;
}

export function StatusStamp({ status }: { status: string }) {
  return (
    <span className={`stamp ${verdictStampClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}
