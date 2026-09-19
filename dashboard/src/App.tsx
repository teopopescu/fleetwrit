import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Overview } from './pages/Overview';
import { Inbox } from './pages/Inbox';
import { RequestDetail } from './pages/RequestDetail';
import { Agents } from './pages/Agents';
import { Catalog } from './pages/Catalog';
import { Ledger } from './pages/Ledger';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/requests/:id" element={<RequestDetail />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/ledger" element={<Ledger />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}
