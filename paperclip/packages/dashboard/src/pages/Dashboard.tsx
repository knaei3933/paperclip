import { useEffect, useState, useCallback } from 'react';
import { api, type AgentListItem, type TaskItem, type EscalationItem } from '../api/client';
import type { WsEvent } from '../api/websocket';

interface Props {
  wsEvent: WsEvent | null;
  wsConnected?: boolean;
}

export function Dashboard({ wsEvent, wsConnected }: Props) {
  const [agentCount, setAgentCount] = useState(0);
  const [activeTasks, setActiveTasks] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    Promise.all([
      api.getAgents().catch(() => ({ agents: [], total: 0 })),
      api.getTasks().catch(() => ({ tasks: [], total: 0 })),
      api.getApprovals().catch(() => ({ escalations: [] })),
    ]).then(([agents, tasks, approvals]) => {
      setAgentCount(agents.total ?? agents.agents.length);
      setActiveTasks(
        (tasks.tasks as TaskItem[]).filter(
          (t) => t.status === 'running' || t.status === 'assigned'
        ).length
      );
      setPendingApprovals(
        (approvals.escalations as EscalationItem[]).filter(
          (e) => e.status === 'pending'
        ).length
      );
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!wsEvent) return;
    if (wsEvent.type === 'agent_status_changed') {
      // Agent status changed, refetch counts
    }
    if (wsEvent.type === 'task_updated') {
      api.getTasks()
        .then((data) => {
          setActiveTasks(
            data.tasks.filter((t) => t.status === 'running' || t.status === 'assigned').length
          );
        })
        .catch(() => {});
    }
    if (wsEvent.type === 'escalation_created') {
      setPendingApprovals((prev) => prev + 1);
    }
  }, [wsEvent]);

  if (loading) return <div style={styles.loading}>読み込み中...</div>;

  return (
    <div>
      <h2 style={styles.heading}>概要</h2>
      <div style={styles.statsGrid}>
        <div style={{ ...styles.statCard, borderColor: '#4ade80' }}>
          <div style={styles.statValue}>{agentCount}</div>
          <div style={styles.statLabel}>稼働エージェント</div>
        </div>
        <div style={{ ...styles.statCard, borderColor: '#22d3ee' }}>
          <div style={styles.statValue}>{activeTasks}</div>
          <div style={styles.statLabel}>実行中タスク</div>
        </div>
        <div style={{ ...styles.statCard, borderColor: '#facc15' }}>
          <div style={styles.statValue}>{pendingApprovals}</div>
          <div style={styles.statLabel}>承認待ち</div>
        </div>
        <div style={{ ...styles.statCard, borderColor: '#94a3b8' }}>
          <div style={styles.statValue}>
            {wsConnected ? (
              <span style={{ color: '#4ade80' }}>接続中</span>
            ) : (
              <span style={{ color: '#64748b' }}>オフライン</span>
            )}
          </div>
          <div style={styles.statLabel}>WebSocket</div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', padding: '1rem' },
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1.5rem 0' },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
  },
  statCard: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '1.25rem',
    textAlign: 'center' as const,
  },
  statValue: { color: '#e2e8f0', fontSize: '2rem', fontWeight: 700, marginBottom: '0.25rem' },
  statLabel: { color: '#64748b', fontSize: '0.85rem' },
};
