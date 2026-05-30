import { useEffect, useState } from 'react';
import { api, type EscalationItem } from '../api/client';
import type { WsEvent } from '../api/websocket';

interface Props {
  wsEvent: WsEvent | null;
}

const URGENCY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  medium: '#facc15',
  high: '#fb923c',
  critical: '#f87171',
};

export function ApprovalQueue({ wsEvent }: Props) {
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<Set<string>>(new Set());

  const fetchEscalations = () => {
    api.getApprovals()
      .then((data) => setEscalations(data.escalations))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchEscalations(); }, []);

  useEffect(() => {
    if (!wsEvent || wsEvent.type !== 'escalation_created') return;
    fetchEscalations();
  }, [wsEvent]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActioning((prev) => new Set(prev).add(id));
    try {
      if (action === 'approve') {
        await api.approveEscalation(id);
      } else {
        await api.rejectEscalation(id);
      }
      setEscalations((prev) => prev.filter((e) => e.id !== id));
    } catch {
      // error handled silently, user can retry
    } finally {
      setActioning((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  if (loading) return <div style={styles.loading}>読み込み中...</div>;
  if (escalations.length === 0) return <div style={styles.empty}>承認待ちはありません。</div>;

  return (
    <div style={styles.list}>
      {escalations.map((esc) => {
        const urgencyColor = URGENCY_COLORS[esc.urgency] ?? '#94a3b8';
        const isActioning = actioning.has(esc.id);
        return (
          <div key={esc.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.taskRef}>タスク: {esc.taskId}</span>
              <span style={{ ...styles.urgency, color: urgencyColor }}>
                {esc.urgency.toUpperCase()}
              </span>
            </div>
            <div style={styles.reason}>{esc.reason}</div>
            <div style={styles.meta}>
              <span>チャンネル: {esc.channel}</span>
              <span>作成日時: {new Date(esc.createdAt).toLocaleString()}</span>
            </div>
            <div style={styles.actions}>
              <button
                style={styles.approveBtn}
                onClick={() => handleAction(esc.id, 'approve')}
                disabled={isActioning}
              >
                承認
              </button>
              <button
                style={styles.rejectBtn}
                onClick={() => handleAction(esc.id, 'reject')}
                disabled={isActioning}
              >
                却下
              </button>
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
  list: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
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
    marginBottom: '0.5rem',
  },
  taskRef: { color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 500 },
  urgency: { fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' },
  reason: { color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '0.5rem' },
  meta: {
    display: 'flex',
    gap: '1rem',
    color: '#64748b',
    fontSize: '0.75rem',
    marginBottom: '0.75rem',
  },
  actions: { display: 'flex', gap: '0.5rem' },
  approveBtn: {
    backgroundColor: '#166534',
    color: '#4ade80',
    border: '1px solid #22c55e',
    borderRadius: '6px',
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  rejectBtn: {
    backgroundColor: '#7f1d1d',
    color: '#f87171',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
};
