import { useEffect, useState } from 'react';
import { api, type BudgetInfo } from '../api/client';

export function BudgetTracker() {
  const [budgets, setBudgets] = useState<BudgetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const CURRENCY = import.meta.env.VITE_CURRENCY_SYMBOL ?? '¥';

  useEffect(() => {
    api.getBudget()
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setBudgets(arr);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loading}>読み込み中...</div>;
  if (budgets.length === 0) return <div style={styles.empty}>予算データがありません。</div>;

  return (
    <div style={styles.list}>
      {budgets.map((b) => {
        const pct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
        const isWarning = pct >= 80;
        const isCritical = pct >= 95;
        const barColor = isCritical ? '#f87171' : isWarning ? '#facc15' : '#4ade80';
        return (
          <div key={b.agentId} style={styles.row}>
            <div style={styles.agentLabel}>{b.agentId}</div>
            <div style={styles.barContainer}>
              <div style={styles.barBg}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
              <span style={styles.pctLabel}>{pct}%</span>
            </div>
            <div style={styles.amounts}>
              <span style={styles.spent}>{CURRENCY}{b.spent.toFixed(2)}</span>
              <span style={styles.limit}> / {CURRENCY}{b.limit.toFixed(2)}</span>
            </div>
            {isWarning && (
              <span style={{
                ...styles.alert,
                color: isCritical ? '#f87171' : '#facc15',
              }}>
                {isCritical ? '危険' : '警告'}
              </span>
            )}
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
  row: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '0.75rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  agentLabel: { color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500, minWidth: '120px' },
  barContainer: { flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' },
  barBg: {
    flex: 1,
    height: '8px',
    backgroundColor: '#1e293b',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  pctLabel: { color: '#94a3b8', fontSize: '0.75rem', minWidth: '35px', textAlign: 'right' as const },
  amounts: { fontSize: '0.8rem', minWidth: '130px', textAlign: 'right' as const },
  spent: { color: '#e2e8f0' },
  limit: { color: '#64748b' },
  alert: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' },
};
