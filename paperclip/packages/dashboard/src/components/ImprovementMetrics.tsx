import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api, type ImprovementMetric } from '../api/client';

export function ImprovementMetrics() {
  const [metrics, setMetrics] = useState<ImprovementMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  useEffect(() => {
    api.getImprovementMetrics()
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        setMetrics(arr);
        if (arr.length > 0 && arr[0]) {
          setSelectedAgent(arr[0].agentId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.loading}>読み込み中...</div>;
  if (metrics.length === 0) return <div style={styles.empty}>改善データがありません。</div>;

  const current = metrics.find((m) => m.agentId === selectedAgent) ?? metrics[0];

  const completionData = (current?.completionTimes ?? []).map((d) => ({
    time: new Date(d.timestamp).toLocaleDateString(),
    value: d.value,
  }));

  const successData = (current?.successRates ?? []).map((d) => ({
    time: new Date(d.timestamp).toLocaleDateString(),
    value: d.value,
  }));

  const costData = (current?.costEfficiency ?? []).map((d) => ({
    time: new Date(d.timestamp).toLocaleDateString(),
    value: d.value,
  }));

  return (
    <div>
      <div style={styles.selector}>
        <label style={styles.label}>エージェント: </label>
        <select
          style={styles.select}
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
        >
          {metrics.map((m) => (
            <option key={m.agentId} value={m.agentId}>
              {m.agentId}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.chartGrid}>
        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>完了時間の推移</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={completionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#16213e', border: '1px solid #2a3a5c' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Line type="monotone" dataKey="value" stroke="#4ade80" strokeWidth={2} dot={false} name="時間 (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>成功率の推移</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={successData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#16213e', border: '1px solid #2a3a5c' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={false} name="率 (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={styles.chartCard}>
          <h3 style={styles.chartTitle}>コスト効率の推移</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={costData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#16213e', border: '1px solid #2a3a5c' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#facc15" strokeWidth={2} dot={false} name="効率" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: { color: '#94a3b8', padding: '1rem' },
  empty: { color: '#64748b', padding: '1rem' },
  selector: { marginBottom: '1rem' },
  label: { color: '#94a3b8', fontSize: '0.85rem', marginRight: '0.5rem' },
  select: {
    backgroundColor: '#16213e',
    color: '#e2e8f0',
    border: '1px solid #2a3a5c',
    borderRadius: '4px',
    padding: '0.3rem 0.5rem',
    fontSize: '0.85rem',
  },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '1rem',
  },
  chartCard: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '1rem',
  },
  chartTitle: {
    color: '#e2e8f0',
    fontSize: '0.9rem',
    fontWeight: 600,
    margin: '0 0 0.75rem 0',
  },
};
