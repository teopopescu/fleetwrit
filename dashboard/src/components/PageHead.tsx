import type { ReactNode } from 'react';

export function PageHead({
  title,
  lede,
  actions,
}: {
  index?: string;
  file?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="pagehead">
      <div className="pagehead__row">
        <div>
          <h1 className="pagehead__title">{title}</h1>
          {lede && <p className="pagehead__lede">{lede}</p>}
        </div>
        {actions && <div className="pagehead__actions">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="sectionhead">
      <h2 className="sectionhead__title">{title}</h2>
      {note && <span className="sectionhead__note mono">{note}</span>}
    </div>
  );
}
