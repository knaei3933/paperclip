import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Proposal, ProposalItem } from '../api/client';
import { ProposalPreview } from '../components/proposal/ProposalPreview';
import { ProposalEditor } from '../components/proposal/ProposalEditor';
import { SpecVerification } from '../components/proposal/SpecVerification';
import { ApproveReject } from '../components/proposal/ApproveReject';

interface Props {
  proposalId: string | null;
}

export function ProposalVerify({ proposalId }: Props) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [localItems, setLocalItems] = useState<ProposalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inputId, setInputId] = useState(proposalId || '');
  const [activeId, setActiveId] = useState(proposalId);

  const loadProposal = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.trading.getProposal(id);
      setProposal(data);
      setLocalItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提案データの取得に失敗しました');
      setProposal(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) {
      loadProposal(activeId);
    } else {
      setLoading(false);
    }
  }, [activeId, loadProposal]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputId.trim()) {
      setActiveId(inputId.trim());
    }
  };

  const handleProposalUpdate = (updated: Proposal) => {
    setProposal(updated);
    setLocalItems(updated.items);
  };

  const handleStatusChange = (updated: Proposal) => {
    setProposal(updated);
  };

  const handleSpecChanged = (items: ProposalItem[]) => {
    setLocalItems(items);
    if (proposal) {
      setProposal({ ...proposal, items });
    }
  };

  if (!activeId) {
    return (
      <div>
        <h2 style={s.heading}>提案確認</h2>
        <div style={s.searchCard}>
          <form onSubmit={handleSearch} style={s.searchForm}>
            <div style={s.searchField}>
              <label style={s.searchLabel}>提案ID</label>
              <input
                style={s.searchInput}
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                placeholder="Proposal ID (UUID)"
              />
            </div>
            <button type="submit" style={s.searchBtn} disabled={!inputId.trim()}>
              検索
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <h2 style={s.heading}>提案確認</h2>
        <div style={s.empty}>読み込み中...</div>
      </div>
    );
  }

  if (error && !proposal) {
    return (
      <div>
        <h2 style={s.heading}>提案確認</h2>
        <div style={s.searchCard}>
          <form onSubmit={handleSearch} style={s.searchForm}>
            <div style={s.searchField}>
              <label style={s.searchLabel}>提案ID</label>
              <input
                style={s.searchInput}
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                placeholder="Proposal ID (UUID)"
              />
            </div>
            <button type="submit" style={s.searchBtn} disabled={!inputId.trim()}>
              検索
            </button>
          </form>
        </div>
        <div style={s.error}>{error}</div>
      </div>
    );
  }

  if (!proposal) return null;

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.heading}>提案確認</h2>
        <button style={s.backBtn} onClick={() => { setActiveId(null); setProposal(null); }}>
          ← 検索に戻る
        </button>
      </div>

      <div style={s.grid}>
        <div style={s.left}>
          <ProposalPreview proposal={{ ...proposal, items: localItems }} />
          <div style={s.spacer} />
          <SpecVerification items={localItems} onChanged={handleSpecChanged} />
        </div>
        <div style={s.right}>
          <ApproveReject proposal={proposal} onStatusChange={handleStatusChange} />
          <div style={s.spacer} />
          <ProposalEditor proposal={{ ...proposal, items: localItems }} onUpdate={handleProposalUpdate} />
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  heading: {
    color: '#e2e8f0',
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 1rem 0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  backBtn: {
    backgroundColor: 'transparent',
    color: '#94a3b8',
    border: '1px solid #2a3a5c',
    borderRadius: '6px',
    padding: '0.3rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  searchCard: {
    backgroundColor: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '1.25rem',
    maxWidth: '500px',
  },
  searchForm: {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-end',
  },
  searchField: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
    flex: 1,
  },
  searchLabel: {
    color: '#94a3b8',
    fontSize: '0.8rem',
    fontWeight: 500,
  },
  searchInput: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #2a3a5c',
    borderRadius: '4px',
    padding: '0.5rem',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
  },
  searchBtn: {
    backgroundColor: '#1e40af',
    color: '#93c5fd',
    border: '1px solid #3b82f6',
    borderRadius: '6px',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.25rem',
    alignItems: 'start',
  },
  left: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
  },
  right: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
  },
  spacer: {
    height: '1rem',
  },
  empty: {
    color: '#64748b',
    fontSize: '0.9rem',
    padding: '2rem',
    textAlign: 'center' as const,
  },
  error: {
    color: '#f87171',
    fontSize: '0.85rem',
    marginTop: '0.75rem',
  },
};
