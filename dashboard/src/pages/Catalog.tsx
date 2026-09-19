import { useStore } from '../store/store';
import { PageHead } from '../components/PageHead';
import { RiskStamp, Stamp } from '../components/Stamp';
import { pct } from '../lib/format';

export function Catalog() {
  const { actionTypes, agents } = useStore();

  const agentsUsing = (type: string) =>
    agents.filter((a) => a.actionTypes.includes(type) || a.undeclaredActionType === type).length;

  return (
    <div className="page">
      <PageHead
        index="03"
        file="catalog.actions"
        title="Action catalog"
        lede="Registered action types, their risk and reversibility, and who owns each one."
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
        {actionTypes.map((t) => (
          <div key={t.type} className={'table__row' + (t.undeclared ? ' table__row--flag' : '')} role="row">
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
          </div>
        ))}
      </div>
    </div>
  );
}
