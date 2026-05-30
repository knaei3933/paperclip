import { useState } from 'react';
import type { Proposal } from '../../api/client';
import { api } from '../../api/client';

interface Props {
  proposal: Proposal;
  onStatusChange: (proposal: Proposal) => void;
}

export function ApproveReject({ proposal, onStatusChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

  const handleApprove = async () => {
    setLoading(true);
    setError('');
    try {
      const updated = await api.trading.approveProposal(proposal.id);
      onStatusChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : '承認に失敗しました');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setError('');
    try {
      const updated = await api.trading.rejectProposal(proposal.id);
      onStatusChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : '却下に失敗しました');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await api.trading.getProposalPdf(proposal.id);
      if (!res.ok) throw new Error('PDF取得に失敗しました');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-${proposal.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDFダウンロードに失敗しました');
    }
  };

  const statusColor: Record<string, string> = {
    draft: '#94a3b8',
    pending_review: '#fbbf24',
    approved: '#4ade80',
    rejected: '#f87171',
  };

  const statusLabel: Record<string, string> = {
    draft: '下書き',
    pending_review: '確認待ち',
    approved: '承認済み',
    rejected: '却下',
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <h3 style={s.title}>アクション</h3>
        <span style={{ ...s.statusBadge, backgroundColor: statusColor[proposal.status] + '22', color: statusColor[proposal.status] }}>
          {statusLabel[proposal.status] || proposal.status}
        </span>
      </div>

      {error && <div style={s.error}>{error}</div>}

      {confirmAction && (
        <div style={s.confirm}>
          <span style={s.confirmText}>
            {confirmAction === 'approve' ? 'この提案を承認しますか？承認後、PDFが生成されます。' : 'この提案を却下しますか？下書きに戻ります。'}
          </span>
          <div style={s.confirmActions}>
            <button
              style={confirmAction === 'approve' ? s.approveBtn : s.rejectBtn}
              onClick={confirmAction === 'approve' ? handleApprove : handleReject}
              disabled={loading}
            >
              {loading ? '処理中...' : confirmAction === 'approve' ? '承認する' : '却下する'}
            </button>
            <button style={s.cancelBtn} onClick={() => setConfirmAction(null)} disabled={loading}>
              キャンセル
            </button>
          </div>
        </div>
      )}

      {!confirmAction && (
        <div style={s.actions}>
          {proposal.status === 'pending_review' && (
            <>
              <button style={s.approveBtn} onClick={() => setConfirmAction('approve')} disabled={loading}>
                承認
              </button>
              <button style={s.rejectBtn} onClick={() => setConfirmAction('reject')} disabled={loading}>
                却下
              </button>
            </>
          )}
          {proposal.pdfPath && (
            <button style={s.pdfBtn} onClick={handleDownloadPdf}>
              PDF ダウンロード
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '1.25rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  title: {
    color: '#e2e8f0',
    fontSize: '1rem',
    fontWeight: 600,
    margin: 0,
  },
  statusBadge: {
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.2rem 0.6rem',
    borderRadius: '10px',
  },
  error: {
    color: '#f87171',
    fontSize: '0.8rem',
    marginBottom: '0.5rem',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
  },
  approveBtn: {
    backgroundColor: '#166534',
    color: '#4ade80',
    border: '1px solid #22c55e',
    borderRadius: '6px',
    padding: '0.5rem 1.25rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  rejectBtn: {
    backgroundColor: '#7f1d1d',
    color: '#fca5a5',
    border: '1px solid #ef4444',
    borderRadius: '6px',
    padding: '0.5rem 1.25rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  pdfBtn: {
    backgroundColor: '#1e293b',
    color: '#93c5fd',
    border: '1px solid #2a3a5c',
    borderRadius: '6px',
    padding: '0.5rem 1.25rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  confirm: {
    backgroundColor: '#0f172a',
    border: '1px solid #2a3a5c',
    borderRadius: '6px',
    padding: '1rem',
    marginBottom: '0.5rem',
  },
  confirmText: {
    color: '#e2e8f0',
    fontSize: '0.85rem',
    display: 'block',
    marginBottom: '0.75rem',
  },
  confirmActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    color: '#94a3b8',
    border: '1px solid #2a3a5c',
    borderRadius: '6px',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};
