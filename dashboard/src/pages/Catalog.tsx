import { Fragment, useState } from 'react';
import { useStore } from '../store/store';
import { PageHead } from '../components/PageHead';
import { RiskStamp, Stamp } from '../components/Stamp';
import { pct } from '../lib/format';

export function Catalog() {
  const { actionTypes, agents } = useStore();
  const [open, setOpen] = useState<string | null>(null);

  const agentsUsing = (type: string) =>
    agents.filter((a) => a.actionTypes.includes(type) || a.undeclaredActionType === type).length;

  return (
    <div className="page">
      <PageHead
        index="03"
        file="catalog.actions"
        title="Action catalog"
        lede="Registered action types, their risk and reversibility, and who owns each one. Select a row for its full definition."
      />

      <div className="table table--catalog" role="table" aria-label="Action types">
        <div className="table__head" role="row">
          <span role="columnheader" className="mono">Type</span>
          <span role="columnheader" className="mono">Title</span>
          <span role="columnheader" className="mono">Risk</span>
          <span role="columnheader" className="mono">Reversible</span>
          <span role="columnheader" className="mono">Owner</span>
          <span role="columnheader" className="mono col-right">Ver</span>
          <span role="columnheader" className="mono col-right">Agents</span>
          <span role="columnheader" className="mono col-right">Approval</span>
        </div>
        {actionTypes.map((t) => {
          const isOpen = open === t.type;
          return (
            <Fragment key={t.type}>
              <button
                type="button"
                className={
                  'table__row table__row--btn' + (t.undeclared ? ' table__row--flag' : '')
                }
                role="row"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : t.type)}
              >
                <span role="cell" className="mono table__title">
                  {t.type}
                  {t.undeclared && <span className="cell-flag mono"> undeclared</span>}
                </span>
                <span role="cell">{t.title}</span>
                <span role="cell"><RiskStamp risk={t.risk} /></span>
                <span role="cell">
                  <Stamp variant={t.reversible ? 'stamp--green' : 'stamp--red'}>
                    {t.reversible ? 'yes' : 'no'}
                  </Stamp>
                </span>
                <span role="cell" className="mono cell-wrap">{t.owner}</span>
                <span role="cell" className="mono tnum col-right">{t.versions}</span>
                <span role="cell" className="mono tnum col-right">{agentsUsing(t.type)}</span>
                <span role="cell" className="mono tnum col-right">
                  {t.undeclared ? '—' : pct(t.approvalRate)}
                </span>
              </button>
              {isOpen && (
                <div className="table__detail">
                  <dl className="args">
                    <div className="args__row">
                      <dt className="args__key mono">Owner</dt>
                      <dd className="args__val mono">{t.owner}</dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Risk</dt>
                      <dd className="args__val"><RiskStamp risk={t.risk} /></dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Queue</dt>
                      <dd className="args__val mono">{t.queue}</dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Reversible</dt>
                      <dd className="args__val">
                        <Stamp variant={t.reversible ? 'stamp--green' : 'stamp--red'}>
                          {t.reversible ? 'yes' : 'no'}
                        </Stamp>
                      </dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Version</dt>
                      <dd className="args__val mono">{t.versions}</dd>
                    </div>
                    <div className="args__row">
                      <dt className="args__key mono">Editable fields</dt>
                      <dd className="args__val">
                        {t.editable.length ? (
                          <span className="mono">{t.editable.join(', ')}</span>
                        ) : (
                          <span className="muted">none</span>
                        )}
                      </dd>
                    </div>
                    {!t.undeclared && (
                      <div className="args__row">
                        <dt className="args__key mono">Approval rate</dt>
                        <dd className="args__val mono">{pct(t.approvalRate)}</dd>
                      </div>
                    )}
                    {t.undeclared && (
                      <div className="args__row">
                        <dt className="args__key mono">Undeclared</dt>
                        <dd className="args__val">
                          <Stamp variant="stamp--amber">observed, never registered</Stamp>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </Fragment>
          );
        })}
        {actionTypes.length === 0 && (
          <div className="empty">
            No action types yet.
            <span className="empty__hint mono">
              Run an agent against this server, or start with <code>fleetwrit dev --demo</code>.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
