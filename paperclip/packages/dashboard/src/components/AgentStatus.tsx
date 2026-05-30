import { useEffect, useState } from 'react';
import { api, type AgentListItem } from '../api/client';
import type { WsEvent } from '../api/websocket';

interface Props {
  wsEvent: WsEvent | null;
}

const STATUS_COLORS: Record<string, string> = {
  idle: '#4ade80',
  running: '#4ade80',
  error: '#f87171',
};

const STATUS_BG: Record<string, string> = {
  idle: 'rgba(74,222,128,0.15)',
  running: 'rgba(74,222,128,0.15)',
  error: 'rgba(248,113,113,0.15)',
};

export function AgentStatus({ wsEvent }: Props) {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAgents()
      .then((data) => setAgents(data.agents))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!wsEvent || wsEvent.type !== 'agent_status_changed') return;
    const payload = wsEvent.data as { agentId: string; status: string };
    setAgents((prev) =>
      prev.map((a) =>
        a.id === payload.agentId ? { ...a, status: payload.status } : a
      )
    );
  }, [wsEvent]);

  if (loading) return <div style={styles.loading}>読み込み中...</div>;
  if (agents.length === 0) return <div style={styles.empty}>エージェントが見つかりません。</div>;

  return (
    <div style={styles.grid}>
      {agents.map((agent) => {
        const color = STATUS_COLORS[agent.status] ?? '#94a3b8';
        const bg = STATUS_BG[agent.status] ?? 'rgba(148,163,184,0.1)';
        const budgetPct = agent.budgetLimit > 0
          ? Math.min(100, Math.round((agent.budgetUsed / agent.budgetLimit) * 100))
          : 0;
        return (
          <div key={agent.id} style={{ ...styles.card, borderColor: color }}>
            <div style={styles.cardHeader}>
              <span style={styles.agentName}>{agent.name}</span>
              <span style={{ ...styles.badge, color, backgroundColor: bg }}>
                {agent.status}
              </span>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.meta}>役割: {agent.role}</div>
              <div style={styles.meta}>部門: {agent.departmentId}</div>
              {agent.currentTaskId && (
                <div style={styles.meta}>タスク: {agent.currentTaskId}</div>
              )}
              <div style={styles.budgetRow}>
                <span style={styles.budgetLabel}>予算</span>
                <div style={styles.budgetBarBg}>
                  <div style={{ ...styles.budgetBarFill, width: `${budgetPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', padding: '1rem' },
  empty: { color: '#64748b', padding: '1rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  },
  card: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '1rem',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  agentName: { color: '#e2e8f0', fontWeight: 600, fontSize: '0.95rem' },
  badge: {
    fontSize: '0.75rem',
    padding: '0.2rem 0.6rem',
    borderRadius: '9999px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  },
  cardBody: { display: 'flex', flexDirection: 'column' as const, gap: '0.35rem' },
  meta: { color: '#94a3b8', fontSize: '0.85rem' },
  budgetRow: { marginTop: '0.5rem' },
  budgetLabel: { color: '#64748b', fontSize: '0.8rem', display: 'block', marginBottom: '0.25rem' },
  budgetBarBg: {
    height: '6px',
    backgroundColor: '#1e293b',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  budgetBarFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
};
