import { useState } from 'react';
import type { ProposalItem } from '../../api/client';

interface Props {
  items: ProposalItem[];
  onChanged: (items: ProposalItem[]) => void;
}

export function SpecVerification({ items, onChanged }: Props) {
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const itemsWithSpecs = items.filter(
    (item) => item.manufacturerSpecs && Object.keys(item.manufacturerSpecs).length > 0
  );

  if (itemsWithSpecs.length === 0) {
    return (
      <div style={s.card}>
        <h3 style={s.title}>仕様確認</h3>
        <div style={s.empty}>仕様データがありません</div>
      </div>
    );
  }

  const handleStartEdit = (itemId: string, key: string, current: string) => {
    setEditField(`${itemId}:${key}`);
    setEditValue(current);
  };

  const handleSaveEdit = (itemIndex: number, key: string) => {
    const updated = [...items];
    const item = { ...updated[itemIndex] };
    item.translatedSpecs = { ...(item.translatedSpecs || {}), [key]: editValue };
    updated[itemIndex] = item;
    onChanged(updated);
    setEditField(null);
  };

  return (
    <div style={s.card}>
      <h3 style={s.title}>仕様確認</h3>
      {itemsWithSpecs.map((item) => {
        const origItem = items.find((i) => i.id === item.id);
        const origIndex = items.indexOf(origItem!);
        const specs = item.manufacturerSpecs || {};
        const translated = item.translatedSpecs || {};
        return (
          <div key={item.id} style={s.itemSection}>
            <div style={s.itemName}>
              {item.equipmentName}
              {item.equipmentNameKo && <span style={s.nameKo}> / {item.equipmentNameKo}</span>}
            </div>
            <div style={s.specGrid}>
              {Object.entries(specs).map(([key, value]) => {
                const fieldKey = `${item.id}:${key}`;
                const isEditing = editField === fieldKey;
                const translatedValue = translated[key] || '';
                return (
                  <div key={key} style={s.specRow}>
                    <div style={s.specKey}>{key}</div>
                    <div style={s.specCol}>
                      <div style={s.langBadgeKo}>KO</div>
                      <span style={s.specValue}>{String(value)}</span>
                    </div>
                    <div style={s.specCol}>
                      <div style={s.langBadgeJa}>JA</div>
                      {isEditing ? (
                        <div style={s.editInline}>
                          <input
                            style={s.editInput}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                          />
                          <button style={s.editSave} onClick={() => handleSaveEdit(origIndex, key)}>OK</button>
                          <button style={s.editCancel} onClick={() => setEditField(null)}>×</button>
                        </div>
                      ) : (
                        <span
                          style={translatedValue ? s.specValue : s.specMissing}
                          onClick={() => handleStartEdit(item.id, key, translatedValue)}
                          title="クリックして編集"
                        >
                          {translatedValue || '翻訳を入力...'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
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
  title: {
    color: '#e2e8f0',
    fontSize: '1rem',
    fontWeight: 600,
    margin: '0 0 1rem 0',
  },
  empty: {
    color: '#64748b',
    fontSize: '0.85rem',
    textAlign: 'center' as const,
    padding: '1rem',
  },
  itemSection: {
    marginBottom: '1rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #1e293b',
  },
  itemName: {
    color: '#e2e8f0',
    fontSize: '0.9rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  nameKo: {
    color: '#64748b',
    fontSize: '0.75rem',
  },
  specGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  },
  specRow: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr 1fr',
    gap: '0.5rem',
    alignItems: 'center',
    fontSize: '0.8rem',
  },
  specKey: {
    color: '#94a3b8',
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  specCol: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
  },
  langBadgeKo: {
    backgroundColor: '#7c2d12',
    color: '#fdba74',
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '0.1rem 0.35rem',
    borderRadius: '3px',
    flexShrink: 0,
  },
  langBadgeJa: {
    backgroundColor: '#1e3a5f',
    color: '#93c5fd',
    fontSize: '0.6rem',
    fontWeight: 700,
    padding: '0.1rem 0.35rem',
    borderRadius: '3px',
    flexShrink: 0,
  },
  specValue: {
    color: '#e2e8f0',
    fontSize: '0.8rem',
  },
  specMissing: {
    color: '#64748b',
    fontSize: '0.8rem',
    fontStyle: 'italic',
    cursor: 'pointer',
  },
  editInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    flex: 1,
  },
  editInput: {
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    border: '1px solid #3b82f6',
    borderRadius: '3px',
    padding: '0.2rem 0.3rem',
    fontSize: '0.8rem',
    fontFamily: 'inherit',
    flex: 1,
    minWidth: 0,
  },
  editSave: {
    backgroundColor: '#166534',
    color: '#4ade80',
    border: 'none',
    borderRadius: '3px',
    padding: '0.2rem 0.4rem',
    cursor: 'pointer',
    fontSize: '0.7rem',
    fontWeight: 600,
  },
  editCancel: {
    backgroundColor: 'transparent',
    color: '#64748b',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0 0.2rem',
  },
};
