import { useStore } from '../store/store';
import { PageHead } from '../components/PageHead';
import { Stamp } from '../components/Stamp';

export function Agents() {
  const { agents, toggleAgent } = useStore();

  return (
    <div className="page">
      <PageHead
        index="02"
        file="agents.register"
        title="Agents"
        lede="Every registered agent, its runtime integration, and the action types it uses."
      />

      <p className="pagehead__lede">
        Disabling an agent blocks its new requests — the server enforces it.
      </p>

      <div className="table table--agents" role="table" aria-label="Agents">
        <div className="table__head" role="row">
          <span role="columnheader" className="mono">Agent</span>
          <span role="columnheader" className="mono">Env</span>
          <span role="columnheader" className="mono">Runtime</span>
          <span role="columnheader" className="mono">SDK</span>
          <span role="columnheader" className="mono">Last seen</span>
          <span role="columnheader" className="mono">Action types</span>
          <span role="columnheader" className="mono col-right">Reqs · 30d</span>
          <span role="columnheader" className="mono col-right">State</span>
        </div>
        {agents.map((a) => (
          <div key={a.id} className="table__row" role="row">
            <span role="cell" className="table__title">{a.id}</span>
            <span role="cell">
              <Stamp variant={a.environment === 'prod' ? 'stamp--accent' : 'stamp--muted'}>
                {a.environment}
              </Stamp>
            </span>
            <span role="cell">{a.runtime}</span>
            <span role="cell" className="mono">{a.sdkVersion}</span>
            <span role="cell" className="mono tnum">{a.lastSeen}</span>
            <span role="cell" className="cell-wrap">
              {a.actionTypes.join(', ')}
              {a.undeclaredActionType && (
                <span className="cell-flag"> +{a.undeclaredActionType} (undeclared)</span>
              )}
            </span>
            <span role="cell" className="mono tnum col-right">{a.volume30d}</span>
            <span role="cell" className="col-right">
              <button
                type="button"
                className={'toggle' + (a.disabled ? ' is-off' : '')}
                role="switch"
                aria-checked={!a.disabled}
                aria-label={`${a.disabled ? 'Enable' : 'Disable'} ${a.id}`}
                title="Disabling an agent blocks its new requests (enforced by the server)."
                onClick={() => toggleAgent(a.id)}
              >
                <span className="toggle__track"><span className="toggle__thumb" /></span>
                <span className="toggle__label mono">{a.disabled ? 'disabled' : 'enabled'}</span>
              </button>
            </span>
          </div>
        ))}
        {agents.length === 0 && (
          <div className="empty">
            No agents registered yet.
            <span className="empty__hint mono">
              Run an agent against this server, or start with <code>fleetwrit dev --demo</code>.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
