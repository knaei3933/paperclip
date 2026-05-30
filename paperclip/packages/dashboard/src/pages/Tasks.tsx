import { useState } from 'react';
import { TaskBoard } from '../components/TaskBoard';
import { api } from '../api/client';
import type { WsEvent } from '../api/websocket';

interface Props {
  wsEvent: WsEvent | null;
}

export function Tasks({ wsEvent }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createTask({ title: title.trim(), description: description.trim(), priority });
      setTitle('');
      setDescription('');
      setPriority(2);
      setShowForm(false);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.heading}>タスク</h2>
        <button style={styles.createBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'キャンセル' : '+ 新規タスク'}
        </button>
      </div>

      {showForm && (
        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>タイトル</label>
            <input
              style={styles.input}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスク名を入力"
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>説明</label>
            <textarea
              style={{ ...styles.input, minHeight: '60px' }}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="タスクの説明を入力"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>優先度</label>
            <select
              style={styles.input}
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            >
              <option value={1}>低</option>
              <option value={2}>中</option>
              <option value={3}>高</option>
              <option value={4}>緊急</option>
            </select>
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.submitBtn} disabled={submitting}>
            {submitting ? '作成中...' : 'タスク作成'}
          </button>
        </form>
      )}

      <TaskBoard wsEvent={wsEvent} refreshKey={refreshKey} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: 0 },
  createBtn: {
    backgroundColor: '#1e40af',
    color: '#93c5fd',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    padding: '0.4rem 1rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  form: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1.5rem',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' },
  label: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 },
  input: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #2a3a5c',
    borderRadius: '4px',
    padding: '0.5rem',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
  },
  error: { color: '#f87171', fontSize: '0.8rem' },
  submitBtn: {
    backgroundColor: '#166534',
    color: '#4ade80',
    border: '1px solid #22c55e',
    borderRadius: '6px',
    padding: '0.5rem 1.5rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    alignSelf: 'flex-start',
  },
};
