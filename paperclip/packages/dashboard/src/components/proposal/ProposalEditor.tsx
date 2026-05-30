import { useState, useCallback } from 'react';
import type { Proposal, ProposalItem } from '../../api/client';
import { api } from '../../api/client';

interface Props {
  proposal: Proposal;
  onUpdate: (proposal: Proposal) => void;
}

export function ProposalEditor({ proposal, onUpdate }: Props) {
  const [items, setItems] = useState<ProposalItem[]>(proposal.items);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  const recalcItem = (item: ProposalItem): ProposalItem => {
    const marginInclusivePrice = Math.round(item.unitPrice * (1 + item.marginRate));
    const subtotal = marginInclusivePrice * item.quantity;
    return { ...item, marginInclusivePrice, subtotal };
  };

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleItemChange = useCallback((index: number, field: keyof ProposalItem, value: string | number) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      if (field === 'marginRate') {
        item.marginRate = typeof value === 'string' ? parseFloat(value) || 0 : value;
      } else if (field === 'quantity') {
        item.quantity = typeof value === 'string' ? parseInt(value, 10) || 1 : value;
      } else if (field === 'unitPrice') {
        item.unitPrice = typeof value === 'string' ? parseInt(value, 10) || 0 : value;
      } else if (field === 'equipmentName' || field === 'equipmentNameKo') {
        (item as unknown as Record<string, string | number>)[field] = value as string;
      }
      updated[index] = recalcItem(item);
      return updated;
    });
    setDirty(true);
  }, []);

  const handleAddItem = () => {
    const newItem: ProposalItem = {
      id: `new-${Date.now()}`,
      equipmentName: '',
      quantity: 1,
      unitPrice: 0,
      marginRate: 0.15,
      marginInclusivePrice: 0,
      subtotal: 0,
    };
    setItems((prev) => [...prev, recalcItem(newItem)]);
    setDirty(true);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await api.trading.updateProposal(proposal.id, {
        items: items.map(({ id, ...rest }) => rest),
      });
      onUpdate(updated);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <h3 style={s.title}>アイテム編集</h3>
        <div style={s.actions}>
          {dirty && (
            <span style={s.dirtyBadge}>未保存</span>
          )}
          <button style={s.addBtn} onClick={handleAddItem}>+ 追加</button>
          <button style={s.saveBtn} onClick={handleSave} disabled={saving || !dirty}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {error && <div style={s.error}>{error}</div>}

      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>品目名</th>
            <th style={{ ...s.th, textAlign: 'right' as const, width: '70px' }}>数量</th>
            <th style={{ ...s.th, textAlign: 'right' as const, width: '100px' }}>単価</th>
            <th style={{ ...s.th, textAlign: 'right' as const, width: '80px' }}>マージン%</th>
            <th style={{ ...s.th, textAlign: 'right' as const, width: '110px' }}>込価格</th>
            <th style={{ ...s.th, textAlign: 'right' as const, width: '110px' }}>小計</th>
            <th style={{ ...s.th, width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={item.id} style={s.tr}>
              <td style={s.td}>
                <input
                  style={s.input}
                  value={item.equipmentName}
                  onChange={(e) => handleItemChange(i, 'equipmentName', e.target.value)}
                />
              </td>
              <td style={s.td}>
                <input
                  style={{ ...s.input, textAlign: 'right' as const, width: '60px' }}
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(i, 'quantity', e.target.value)}
                />
              </td>
              <td style={s.td}>
                <input
                  style={{ ...s.input, textAlign: 'right' as const, width: '90px' }}
                  type="number"
                  min="0"
                  value={item.unitPrice}
                  onChange={(e) => handleItemChange(i, 'unitPrice', e.target.value)}
                />
              </td>
              <td style={s.td}>
                <input
                  style={{ ...s.input, textAlign: 'right' as const, width: '70px' }}
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={item.marginRate}
                  onChange={(e) => handleItemChange(i, 'marginRate', e.target.value)}
                />
              </td>
              <td style={{ ...s.td, textAlign: 'right' as const, color: '#94a3b8' }}>
                {item.marginInclusivePrice.toLocaleString()}
              </td>
              <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 600 }}>
                {item.subtotal.toLocaleString()}
              </td>
              <td style={s.td}>
                <button style={s.removeBtn} onClick={() => handleRemoveItem(i)} title="削除">×</button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700 }}>合計</td>
            <td style={{ ...s.td, textAlign: 'right' as const, fontWeight: 700, color: '#fcd34d' }}>
              {totalAmount.toLocaleString()} JPY
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
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
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  dirtyBadge: {
    color: '#fbbf24',
    fontSize: '0.7rem',
    backgroundColor: '#78350f',
    padding: '0.15rem 0.5rem',
    borderRadius: '10px',
  },
  addBtn: {
    backgroundColor: '#1e293b',
    color: '#93c5fd',
    border: '1px solid #2a3a5c',
    borderRadius: '4px',
    padding: '0.3rem 0.6rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  saveBtn: {
    backgroundColor: '#166534',
    color: '#4ade80',
    border: '1px solid #22c55e',
    borderRadius: '4px',
    padding: '0.3rem 0.75rem',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  error: {
    color: '#f87171',
    fontSize: '0.8rem',
    marginBottom: '0.5rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.85rem',
  },
  th: {
    color: '#94a3b8',
    fontWeight: 500,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    padding: '0.5rem 0.4rem',
    borderBottom: '1px solid #2a3a5c',
    textAlign: 'left' as const,
  },
  tr: {
    borderBottom: '1px solid #1e293b',
  },
  td: {
    color: '#e2e8f0',
    padding: '0.4rem',
    fontSize: '0.85rem',
  },
  input: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #2a3a5c',
    borderRadius: '4px',
    padding: '0.3rem 0.4rem',
    fontSize: '0.85rem',
    fontFamily: 'inherit',
    width: '100%',
    minWidth: '60px',
  },
  removeBtn: {
    backgroundColor: 'transparent',
    color: '#64748b',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0.2rem',
    lineHeight: 1,
  },
};
