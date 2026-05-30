import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Deal, Email } from '../api/client';

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

interface Props {
  dealId: string;
  onBack: () => void;
}

export function DealDetail({ dealId, onBack }: Props) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dealData, emailData] = await Promise.all([
        api.trading.getDeal(dealId),
        api.trading.getDealEmails(dealId),
      ]);
      setDeal(dealData);
      setEmails(emailData);
      if (dealData.customerId && !composeData.to) {
        setComposeData(prev => ({ ...prev, to: '' }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdvance = async () => {
    try {
      const updated = await api.trading.advanceDeal(dealId);
      setDeal(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ステージ変更に失敗しました');
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeData.to || !composeData.subject) return;
    setSending(true);
    setError('');
    try {
      await api.trading.sendDealEmail(dealId, composeData);
      setShowCompose(false);
      setComposeData({ to: '', subject: '', body: '' });
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メール送信に失敗しました');
    } finally {
      setSending(false);
    }
  };

  const currentStageIdx = deal ? STAGES.findIndex(s => s.key === deal.stage) : -1;

  if (loading) return <div style={s.empty}>読み込み中...</div>;
  if (!deal) return <div style={s.empty}>案件が見つかりません</div>;

  return (
    <div>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>&larr; 戻る</button>
        <h2 style={s.heading}>{deal.title}</h2>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {/* Deal Info */}
      <div style={s.infoCard}>
        <div style={s.infoGrid}>
          <div style={s.infoField}>
            <span style={s.infoLabel}>顧客ID</span>
            <span style={s.infoValue}>{deal.customerId}</span>
          </div>
          {deal.amount && (
            <div style={s.infoField}>
              <span style={s.infoLabel}>金額</span>
              <span style={s.infoValue}>{deal.amount.toLocaleString()} JPY</span>
            </div>
          )}
          <div style={s.infoField}>
            <span style={s.infoLabel}>確度</span>
            <span style={s.infoValue}>{deal.probability}%</span>
          </div>
          {deal.manufacturerId && (
            <div style={s.infoField}>
              <span style={s.infoLabel}>メーカーID</span>
              <span style={s.infoValue}>{deal.manufacturerId}</span>
            </div>
          )}
        </div>
        {deal.notes && <p style={s.description}>{deal.notes}</p>}
      </div>

      {/* Stage Stepper */}
      <div style={s.stepperSection}>
        <h3 style={s.sectionTitle}>ステージ</h3>
        <div style={s.stepper}>
          {STAGES.map((stage, i) => {
            const isActive = stage.key === deal.stage;
            const isDone = i < currentStageIdx;
            const isNext = i === currentStageIdx + 1;
            return (
              <div key={stage.key} style={s.stepWrapper}>
                <div style={{
                  ...s.stepNode,
                  backgroundColor: isActive ? '#1e40af' : isDone ? '#166534' : '#1e293b',
                  borderColor: isActive ? '#3b82f6' : isDone ? '#22c55e' : '#2a3a5c',
                }}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span style={{
                  ...s.stepLabel,
                  color: isActive ? '#93c5fd' : isDone ? '#4ade80' : '#64748b',
                  fontWeight: isActive ? 700 : 400,
                }}>
                  {stage.label}
                </span>
                {isNext && (
                  <button style={s.advanceBtn} onClick={() => handleAdvance()}>
                    進む
                  </button>
                )}
                {i < STAGES.length - 1 && (
                  <div style={{
                    ...s.stepConnector,
                    backgroundColor: isDone ? '#22c55e' : '#1e293b',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Email Thread */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <h3 style={s.sectionTitle}>メール</h3>
          <button style={s.composeBtn} onClick={() => setShowCompose(!showCompose)}>
            {showCompose ? 'キャンセル' : '+ メール作成'}
          </button>
        </div>

        {showCompose && (
          <form style={s.composeForm} onSubmit={handleSendEmail}>
            <div style={s.field}>
              <label style={s.label}>宛先</label>
              <input style={s.input} value={composeData.to} onChange={e => setComposeData({ ...composeData, to: e.target.value })} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>件名</label>
              <input style={s.input} value={composeData.subject} onChange={e => setComposeData({ ...composeData, subject: e.target.value })} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>本文</label>
              <textarea style={{ ...s.input, minHeight: '100px' }} value={composeData.body} onChange={e => setComposeData({ ...composeData, body: e.target.value })} />
            </div>
            <button type="submit" style={s.sendBtn} disabled={sending}>{sending ? '送信中...' : '送信'}</button>
          </form>
        )}

        {emails.length === 0 ? (
          <div style={s.emptySmall}>関連メールはありません</div>
        ) : (
          <div style={s.emailList}>
            {emails.map(email => (
              <div key={email.id} style={s.emailItem}>
                <div style={s.emailHeader}>
                  <span style={emailDirectionStyle(email.direction)}>
                    {email.direction === 'inbound' ? '← 受信' : '→ 送信'}
                  </span>
                  <span style={s.emailFrom}>{email.from}</span>
                  <span style={s.emailDate}>{email.sentAt ? new Date(email.sentAt).toLocaleString('ja-JP') : ''}</span>
                </div>
                <div style={s.emailSubject}>{email.subject}</div>
                <div style={s.emailBody}>{email.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function emailDirectionStyle(dir: string): React.CSSProperties {
  return { fontSize: '0.75rem', fontWeight: 600, color: dir === 'inbound' ? '#93c5fd' : '#4ade80' };
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' },
  backBtn: { backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #2a3a5c', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem' },
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: 0 },
  error: { color: '#f87171', fontSize: '0.8rem', marginBottom: '0.5rem' },
  infoCard: { backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  infoField: { display: 'flex', flexDirection: 'column' as const, gap: '0.2rem' },
  infoLabel: { color: '#94a3b8', fontSize: '0.75rem' },
  infoValue: { color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 500 },
  description: { color: '#94a3b8', fontSize: '0.85rem', margin: '0.75rem 0 0 0', lineHeight: 1.5 },
  stepperSection: { marginBottom: '1.5rem' },
  sectionTitle: { color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' },
  stepper: { display: 'flex', alignItems: 'flex-start', gap: '0', overflowX: 'auto' as const, paddingBottom: '0.5rem' },
  stepWrapper: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', minWidth: '80px', position: 'relative' as const },
  stepNode: { width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, border: '2px solid', marginBottom: '0.3rem', color: '#e2e8f0' },
  stepLabel: { fontSize: '0.7rem', textAlign: 'center' as const, whiteSpace: 'nowrap' as const },
  advanceBtn: { marginTop: '0.25rem', backgroundColor: '#1e40af', color: '#93c5fd', border: 'none', borderRadius: '4px', padding: '0.15rem 0.4rem', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600 },
  stepConnector: { position: 'absolute' as const, top: '15px', left: 'calc(50% + 15px)', width: 'calc(100% - 30px)', height: '2px' },
  section: { marginBottom: '1.5rem' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  composeBtn: { backgroundColor: '#1e40af', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 },
  composeForm: { backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' },
  label: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 },
  input: { backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #2a3a5c', borderRadius: '4px', padding: '0.5rem', fontSize: '0.85rem', fontFamily: 'inherit' },
  sendBtn: { backgroundColor: '#166534', color: '#4ade80', border: '1px solid #22c55e', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, alignSelf: 'flex-start' },
  emailList: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  emailItem: { backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: '6px', padding: '0.75rem' },
  emailHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' },
  emailFrom: { color: '#94a3b8', fontSize: '0.8rem', flex: 1 },
  emailDate: { color: '#64748b', fontSize: '0.75rem' },
  emailSubject: { color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' },
  emailBody: { color: '#94a3b8', fontSize: '0.8rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const },
  empty: { color: '#64748b', fontSize: '0.9rem', padding: '2rem', textAlign: 'center' as const },
  emptySmall: { color: '#64748b', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' as const },
};
