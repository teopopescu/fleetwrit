import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  IconOverview,
  IconInbox,
  IconAgents,
  IconCatalog,
  IconLedger,
  IconSettings,
  IconMark,
} from './Icons';
import { useStore } from '../store/store';

const NAV = [
  { to: '/', label: 'Overview', end: true, Icon: IconOverview },
  { to: '/inbox', label: 'Inbox', end: false, Icon: IconInbox },
  { to: '/agents', label: 'Agents', end: false, Icon: IconAgents },
  { to: '/catalog', label: 'Catalog', end: false, Icon: IconCatalog },
  { to: '/ledger', label: 'Ledger', end: false, Icon: IconLedger },
  { to: '/settings', label: 'Settings', end: false, Icon: IconSettings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { requests, endpointLabel } = useStore();
  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__mark" aria-hidden>
            <IconMark size={20} />
          </span>
          <span className="sidebar__wordmark">Fleetwrit</span>
        </div>
        <nav className="nav" aria-label="Primary">
          {NAV.map(({ to, label, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                'nav__link' + (isActive ? ' is-active' : '')
              }
            >
              <Icon size={17} className="nav__icon" />
              <span>{label}</span>
              {label === 'Inbox' && pending > 0 && (
                <span className="nav__count mono">{pending}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__foot">
          <div className="sidebar__reviewer">
            <span className="sidebar__reviewer-label mono">Reviewer</span>
            <span className="sidebar__reviewer-name">you@acme.com</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__env">
            <span className="topbar__ws">Acme</span>
            <span className="topbar__sep" aria-hidden>/</span>
            <span className="topbar__envchip mono">prod</span>
          </div>
          <div className="topbar__demo" role="status">
            <span className="topbar__dot" aria-hidden />
            <span className="mono">{endpointLabel}</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
