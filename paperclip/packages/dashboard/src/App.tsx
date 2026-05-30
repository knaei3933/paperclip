import { useState } from 'react';
import { useWebSocket } from './api/websocket';
import { isAuthenticated, clearAuthToken } from './api/client';
import { LoginPage } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { Tasks } from './pages/Tasks';
import { Approvals } from './pages/Approvals';
import { Settings } from './pages/Settings';
import { Customers } from './pages/Customers';
import { Manufacturers } from './pages/Manufacturers';
import { Equipment } from './pages/Equipment';
import { Deals } from './pages/Deals';
import { Documents } from './pages/Documents';
import { ProposalVerify } from './pages/ProposalVerify';

type Page = 'dashboard' | 'agents' | 'tasks' | 'approvals' | 'settings' | 'customers' | 'manufacturers' | 'equipment' | 'deals' | 'documents' | 'proposal-verify';

const NAV_ITEMS: { key: Page; label: string }[] = [
  { key: 'dashboard', label: 'ダッシュボード' },
  { key: 'agents', label: 'エージェント' },
  { key: 'tasks', label: 'タスク' },
  { key: 'approvals', label: '承認' },
  { key: 'customers', label: '顧客' },
  { key: 'manufacturers', label: 'メーカー' },
  { key: 'equipment', label: '設備' },
  { key: 'deals', label: '案件' },
  { key: 'documents', label: '文書' },
  { key: 'proposal-verify', label: '提案確認' },
  { key: 'settings', label: '設定' },
];

export function App() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [page, setPage] = useState<Page>('dashboard');
  const [proposalId, setProposalId] = useState<string | null>(null);
  const { lastEvent, connected } = useWebSocket();

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />;
  }

  const handleNavigateProposal = (id: string) => {
    setProposalId(id);
    setPage('proposal-verify');
  };

  const handleLogout = () => {
    clearAuthToken();
    setAuthenticated(false);
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard wsEvent={lastEvent} wsConnected={connected} />;
      case 'agents':
        return <Agents wsEvent={lastEvent} />;
      case 'tasks':
        return <Tasks wsEvent={lastEvent} />;
      case 'approvals':
        return <Approvals wsEvent={lastEvent} />;
      case 'customers':
        return <Customers />;
      case 'manufacturers':
        return <Manufacturers />;
      case 'equipment':
        return <Equipment />;
      case 'deals':
        return <Deals />;
      case 'documents':
        return <Documents />;
      case 'proposal-verify':
        return <ProposalVerify proposalId={proposalId} />;
      case 'settings':
        return <Settings />;
    }
  };

  return (
    <div style={styles.layout}>
      <nav style={styles.sidebar}>
        <div style={styles.logo}>Paperclip</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            style={{
              ...styles.navItem,
              backgroundColor: page === item.key ? '#1e40af' : 'transparent',
              color: page === item.key ? '#93c5fd' : '#94a3b8',
            }}
            onClick={() => setPage(item.key)}
          >
            {item.label}
          </button>
        ))}
        <div style={styles.wsStatus}>
          <span
            style={{
              ...styles.wsDot,
              backgroundColor: connected ? '#4ade80' : '#64748b',
            }}
          />
          {connected ? '接続済み' : '未接続'}
        </div>
        <button style={styles.logoutBtn} onClick={handleLogout}>
          ログアウト
        </button>
      </nav>
      <main style={styles.main}>{renderPage()}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", "Noto Sans KR", "Yu Gothic", "Meiryo", "Malgun Gothic", sans-serif',
  },
  sidebar: {
    width: '220px',
    minWidth: '220px',
    backgroundColor: '#0f172a',
    borderRight: '1px solid #1e293b',
    padding: '1.5rem 0',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  logo: {
    color: '#e2e8f0',
    fontSize: '1.2rem',
    fontWeight: 700,
    padding: '0 1.25rem',
    marginBottom: '2rem',
    letterSpacing: '0.05em',
  },
  navItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    border: 'none',
    padding: '0.65rem 1.25rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
    borderRadius: '0',
    transition: 'all 0.15s ease',
  },
  wsStatus: {
    marginTop: 'auto',
    padding: '0.75rem 1.25rem',
    color: '#64748b',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  wsDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
  },
  logoutBtn: {
    marginTop: '0.75rem',
    margin: '0.75rem 1.25rem 0 1.25rem',
    backgroundColor: 'transparent',
    color: '#64748b',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    padding: '0.4rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    textAlign: 'left' as const,
  },
  main: {
    flex: 1,
    padding: '2rem',
    overflowY: 'auto' as const,
    minWidth: 0,
  },
};
