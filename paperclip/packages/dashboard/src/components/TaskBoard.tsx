import { useEffect, useState, useCallback } from 'react';
import { api, type TaskItem } from '../api/client';
import type { WsEvent } from '../api/websocket';

interface Props {
  wsEvent: WsEvent | null;
  refreshKey?: number;
}

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'queued', label: '待機中', color: '#94a3b8' },
  { key: 'assigned', label: '割り当て済み', color: '#facc15' },
  { key: 'running', label: '実行中', color: '#4ade80' },
  { key: 'completed', label: '完了', color: '#22d3ee' },
  { key: 'failed', label: '失敗', color: '#f87171' },
];

const PRIORITY_LABELS: Record<number, string> = {
  1: '低',
  2: '中',
  3: '高',
  4: '緊急',
};

export function TaskBoard({ wsEvent, refreshKey }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(() => {
    api.getTasks()
      .then((data) => setTasks(data.tasks))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks, refreshKey]);

  useEffect(() => {
    if (!wsEvent || wsEvent.type !== 'task_updated') return;
    fetchTasks();
  }, [wsEvent, fetchTasks]);

  if (loading) return <div style={styles.loading}>読み込み中...</div>;

  return (
    <div style={styles.board}>
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.key);
        return (
          <div key={col.key} style={styles.column}>
            <div style={{ ...styles.columnHeader, borderBottomColor: col.color }}>
              <span style={{ ...styles.columnDot, backgroundColor: col.color }} />
              {col.label}
              <span style={styles.count}>{colTasks.length}</span>
            </div>
            <div style={styles.cardList}>
              {colTasks.map((task) => (
                <div key={task.id} style={styles.card}>
                  <div style={styles.cardTitle}>{task.title}</div>
                  <div style={styles.cardMeta}>
                    <span>担当: {task.assigneeId || '未割り当て'}</span>
                  </div>
                  <div style={styles.cardFooter}>
                    <span style={{
                      ...styles.priority,
                      color: task.priority >= 3 ? '#f87171' : '#94a3b8',
                    }}>
                      {PRIORITY_LABELS[task.priority] ?? `P${task.priority}`}
                    </span>
                    <span style={styles.budget}>
                      ${task.budgetUsed} / ${task.budgetAllocated}
                    </span>
                  </div>
                </div>
              ))}
              {colTasks.length === 0 && (
                <div style={styles.empty}>タスクなし</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', padding: '1rem' },
  board: {
    display: 'flex',
    gap: '1rem',
    overflowX: 'auto' as const,
    minHeight: '400px',
  },
  column: {
    minWidth: '220px',
    flex: '1 1 0',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '0.75rem',
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#e2e8f0',
    fontWeight: 600,
    fontSize: '0.9rem',
    paddingBottom: '0.5rem',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    marginBottom: '0.75rem',
  },
  columnDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  count: {
    marginLeft: 'auto',
    backgroundColor: '#1e293b',
    color: '#94a3b8',
    fontSize: '0.75rem',
    padding: '0.1rem 0.5rem',
    borderRadius: '9999px',
  },
  cardList: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  card: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '6px',
    padding: '0.75rem',
  },
  cardTitle: { color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.35rem' },
  cardMeta: { color: '#64748b', fontSize: '0.75rem', marginBottom: '0.35rem' },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.75rem',
  },
  priority: { fontWeight: 600 },
  budget: { color: '#94a3b8' },
  empty: { color: '#475569', fontSize: '0.8rem', textAlign: 'center' as const, padding: '1rem 0' },
};
