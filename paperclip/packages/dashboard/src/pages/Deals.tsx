import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Deal } from '../api/client';
import { DealDetail } from './DealDetail';

const STAGES = [
  { key: 'lead', label: 'リード' },
  { key: 'qualified', label: '確度あり' },
  { key: 'proposal', label: '提案' },
  { key: 'negotiation', label: '交渉' },
  { key: 'contract', label: '契約' },
  { key: 'delivery', label: '納品' },
  { key: 'installation', label: '設置' },
  { key: 'complete', label: '完了' },
  { key: 'as', label: 'AS保守' },
];

const STAGE_COLORS: Record<string, string> = {
  lead: '#6366f1',
  qualified: '#8b5cf6',
  proposal: '#3b82f6',
  negotiation: '#f59e0b',
  contract: '#10b981',
  delivery: '#06b6d4',
  installation: '#14b8a6',
  complete: '#22c55e',
  as: '#94a3b8',
};

export function Deals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', customerId: '', manufacturerId: '', amount: '', stage: 'lead' as const, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.trading.getDeals();
      setDeals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '案件データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...formData,
        amount: formData.amount ? Number(formData.amount) : undefined,
      };
      await api.trading.createDeal(payload);
      setShowForm(false);
      setFormData({ title: '', customerId: '', manufacturerId: '', amount: '', stage: 'lead', notes: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvance = async (dealId: string) => {
    try {
      await api.trading.advanceDeal(dealId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ステージ変更に失敗しました');
    }
  };

  const formatAmount = (amount?: number | null) => {
    if (!amount) return '';
    if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}億`;
    if (amount >= 10000) return `${(amount / 10000).toFixed(0)}万`;
    return `${amount.toLocaleString()}`;
  };

  const getDealsForStage = (stageKey: string) => deals.filter(d => d.stage === stageKey);

  return (
    <div>
      {selectedDealId ? (
        <DealDetail dealId={selectedDealId} onBack={() => { setSelectedDealId(null); loadData(); }} />
      ) : (
      <>
      <div style={s.header}>
        <h2 style={s.heading}>案件</h2>
        <button style={s.createBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'キャンセル' : '+ 新規案件'}
        </button>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {showForm && (
        <form style={s.form} onSubmit={handleSubmit}>
          <h3 style={s.formTitle}>新規案件</h3>
          <div style={s.formGrid}>
            <div style={s.field}>
              <label style={s.label}>案件名 *</label>
              <input style={s.input} value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>顧客ID</label>
              <input style={s.input} value={formData.customerId} onChange={e => setFormData({ ...formData, customerId: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>金額</label>
              <input style={s.input} type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>メーカーID</label>
              <input style={s.input} value={formData.manufacturerId} onChange={e => setFormData({ ...formData, manufacturerId: e.target.value })} placeholder="UUID (任意)" />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>メモ</label>
            <textarea style={{ ...s.input, minHeight: '60px' }} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
          </div>
          <div style={s.formActions}>
            <button type="submit" style={s.submitBtn} disabled={submitting}>{submitting ? '作成中...' : '案件作成'}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={s.empty}>読み込み中...</div>
      ) : (
        <div style={s.kanbanContainer}>
          {STAGES.map(stage => {
            const stageDeals = getDealsForStage(stage.key);
            return (
              <div key={stage.key} style={s.column}>
                <div style={{ ...s.columnHeader, borderTopColor: STAGE_COLORS[stage.key] }}>
                  <span style={s.columnTitle}>{stage.label}</span>
                  <span style={s.columnCount}>{stageDeals.length}</span>
                </div>
                <div style={s.columnBody}>
                  {stageDeals.map(deal => {
                    const stageIdx = STAGES.findIndex(st => st.key === stage.key);
                    const nextStage = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1] : null;
                    return (
                      <div key={deal.id} style={s.card} onClick={() => setSelectedDealId(deal.id)}>
                        <div style={s.cardTitle}>{deal.title}</div>
                        <div style={s.cardCustomer}>{deal.customerId}</div>
                        {deal.amount ? (
                          <div style={s.cardAmount}>{formatAmount(deal.amount)}</div>
                        ) : null}
                        {nextStage && (
                          <button
                            style={s.advanceBtn}
                            onClick={e => { e.stopPropagation(); handleAdvance(deal.id); }}
                          >
                            {nextStage.label}へ進む
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: 0 },
  createBtn: { backgroundColor: '#1e40af', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: '6px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  error: { color: '#f87171', fontSize: '0.8rem', marginBottom: '0.5rem' },
  form: { backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' },
  formTitle: { color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' },
  label: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 },
  input: { backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #2a3a5c', borderRadius: '4px', padding: '0.5rem', fontSize: '0.85rem', fontFamily: 'inherit' },
  formActions: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem' },
  submitBtn: { backgroundColor: '#166534', color: '#4ade80', border: '1px solid #22c55e', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  kanbanContainer: { display: 'flex', gap: '0.75rem', overflowX: 'auto' as const, paddingBottom: '1rem' },
  column: { minWidth: '220px', maxWidth: '220px', backgroundColor: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column' as const, flexShrink: 0 },
  columnHeader: { padding: '0.6rem 0.75rem', borderTop: '3px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  columnTitle: { color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 600 },
  columnCount: { color: '#94a3b8', fontSize: '0.75rem', backgroundColor: '#1e293b', padding: '0.1rem 0.5rem', borderRadius: '10px' },
  columnBody: { padding: '0.5rem', display: 'flex', flexDirection: 'column' as const, gap: '0.5rem', flex: 1, minHeight: '100px' },
  card: { backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: '6px', padding: '0.6rem', cursor: 'pointer', transition: 'border-color 0.15s' },
  cardTitle: { color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' },
  cardCustomer: { color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.25rem' },
  cardAmount: { color: '#fcd34d', fontSize: '0.8rem', fontWeight: 600 },
  advanceBtn: { backgroundColor: 'transparent', color: '#93c5fd', border: '1px solid #2a3a5c', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.7rem', marginTop: '0.4rem', width: '100%' },
  empty: { color: '#64748b', fontSize: '0.9rem', padding: '2rem', textAlign: 'center' as const },
};
