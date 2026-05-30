import { useEffect, useState } from 'react';
import { api, type ThresholdItem } from '../api/client';

export function Settings() {
  const [thresholds, setThresholds] = useState<ThresholdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edited, setEdited] = useState<Record<string, ThresholdItem>>({});
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  useEffect(() => {
    api.getThresholds()
      .then((data) => {
        const arr = data.thresholds ?? [];
        setThresholds(arr);
        const map: Record<string, ThresholdItem> = {};
        for (const t of arr) {
          map[t.id] = { ...t };
        }
        setEdited(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setIsSuccess(null);
    try {
      for (const t of Object.values(edited)) {
        await api.updateThresholds(t);
      }
      setMessage('設定を保存しました。');
      setThresholds(Object.values(edited));
      setIsSuccess(true);
    } catch {
      setMessage('設定の保存に失敗しました。');
      setIsSuccess(false);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (id: string, field: keyof ThresholdItem, value: string | number) => {
    setEdited((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  if (loading) return <div style={styles.loading}>読み込み中...</div>;

  return (
    <div>
      <h2 style={styles.heading}>設定</h2>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>対象</th>
              <th style={styles.th}>値</th>
              <th style={styles.th}>タイムアウト (ms)</th>
              <th style={styles.th}>タイムアウト時の動作</th>
              <th style={styles.th}>スコープ</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.map((t) => {
              const e = edited[t.id];
              if (!e) return null;
              return (
                <tr key={t.id}>
                  <td style={styles.td}>
                    <input
                      style={styles.tableInput}
                      value={e.dimension}
                      onChange={(ev) => updateField(t.id, 'dimension', ev.target.value)}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      style={{ ...styles.tableInput, width: '80px' }}
                      type="number"
                      value={e.value}
                      onChange={(ev) => updateField(t.id, 'value', Number(ev.target.value))}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      style={{ ...styles.tableInput, width: '100px' }}
                      type="number"
                      value={e.timeoutMs}
                      onChange={(ev) => updateField(t.id, 'timeoutMs', Number(ev.target.value))}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      style={styles.tableInput}
                      value={e.timeoutAction}
                      onChange={(ev) => updateField(t.id, 'timeoutAction', ev.target.value)}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      style={styles.tableInput}
                      value={e.scope}
                      onChange={(ev) => updateField(t.id, 'scope', ev.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {message && (
        <div style={{ ...styles.message, color: isSuccess ? '#4ade80' : '#f87171' }}>
          {message}
        </div>
      )}

      <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
        {saving ? '保存中...' : '設定を保存'}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', padding: '1rem' },
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: '0 0 1.5rem 0' },
  tableContainer: { overflowX: 'auto' as const },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    backgroundColor: '#16213e',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  th: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    padding: '0.75rem 1rem',
    textAlign: 'left' as const,
    borderBottom: '1px solid #2a3a5c',
  },
  td: {
    padding: '0.5rem 1rem',
    borderBottom: '1px solid #1e293b',
  },
  tableInput: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #2a3a5c',
    borderRadius: '4px',
    padding: '0.3rem 0.5rem',
    fontSize: '0.85rem',
    width: '100%',
    minWidth: '60px',
  },
  message: { fontSize: '0.85rem', marginTop: '1rem', marginBottom: '0.5rem' },
  saveBtn: {
    marginTop: '1rem',
    backgroundColor: '#1e40af',
    color: '#93c5fd',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    padding: '0.5rem 1.5rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
};
