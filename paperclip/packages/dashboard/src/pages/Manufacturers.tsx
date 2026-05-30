import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Manufacturer } from '../api/client';

export function Manufacturers() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [formData, setFormData] = useState({ name: '', nameKorean: '', tier: 1, country: '', equipmentCategories: '', contactEmail: '', contactPhone: '', website: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const filters: Record<string, string> = {};
      if (tierFilter !== null) filters.tier = String(tierFilter);
      if (search) filters.search = search;
      const data = await api.trading.getManufacturers(filters);
      setManufacturers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メーカーデータの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [tierFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', nameKorean: '', tier: 1, country: '', equipmentCategories: '', contactEmail: '', contactPhone: '', website: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (m: Manufacturer) => {
    setEditing(m);
    setFormData({
      name: m.name, nameKorean: m.nameKorean ?? '', tier: m.tier, country: m.country,
      equipmentCategories: m.equipmentCategories.join(', '),
      contactEmail: m.contactEmail ?? '', contactPhone: m.contactPhone ?? '',
      website: m.website ?? '', notes: m.notes ?? '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...formData,
        equipmentCategories: formData.equipmentCategories.split(',').map(s => s.trim()).filter(Boolean),
      };
      if (editing) {
        await api.trading.updateManufacturer(editing.id, payload);
      } else {
        await api.trading.createManufacturer(payload);
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.trading.deleteManufacturer(id);
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const tierButtons = [
    { label: '全て', value: null },
    { label: 'Tier 1', value: 1 },
    { label: 'Tier 2', value: 2 },
    { label: 'Tier 3', value: 3 },
  ];

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.heading}>メーカー</h2>
        <button style={s.createBtn} onClick={openCreate}>+ 新規メーカー</button>
      </div>

      <div style={s.filterRow}>
        <div style={s.tierButtons}>
          {tierButtons.map(b => (
            <button
              key={String(b.value)}
              style={{ ...s.tierBtn, backgroundColor: tierFilter === b.value ? '#1e40af' : '#0f172a', color: tierFilter === b.value ? '#93c5fd' : '#94a3b8' }}
              onClick={() => setTierFilter(b.value)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <input
          style={s.searchInput}
          placeholder="メーカー名、担当者で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && <div style={s.error}>{error}</div>}

      {showForm && (
        <form style={s.form} onSubmit={handleSubmit}>
          <h3 style={s.formTitle}>{editing ? 'メーカー編集' : '新規メーカー'}</h3>
          <div style={s.formGrid}>
            <div style={s.field}>
              <label style={s.label}>メーカー名 *</label>
              <input style={s.input} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>韓国語名</label>
              <input style={s.input} value={formData.nameKorean} onChange={e => setFormData({ ...formData, nameKorean: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Tier</label>
              <select style={s.input} value={formData.tier} onChange={e => setFormData({ ...formData, tier: Number(e.target.value) })}>
                <option value={1}>Tier 1 (大型)</option>
                <option value={2}>Tier 2 (中堅)</option>
                <option value={3}>Tier 3 (専門)</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>国</label>
              <input style={s.input} value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>設備カテゴリ (カンマ区切り)</label>
              <input style={s.input} value={formData.equipmentCategories} onChange={e => setFormData({ ...formData, equipmentCategories: e.target.value })} placeholder="例: CNC, レーザー, プレス" />
            </div>
            <div style={s.field}>
              <label style={s.label}>メール</label>
              <input style={s.input} type="email" value={formData.contactEmail} onChange={e => setFormData({ ...formData, contactEmail: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>電話</label>
              <input style={s.input} value={formData.contactPhone} onChange={e => setFormData({ ...formData, contactPhone: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Webサイト</label>
              <input style={s.input} value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div style={s.formActions}>
            <button type="submit" style={s.submitBtn} disabled={submitting}>{submitting ? '保存中...' : '保存'}</button>
            <button type="button" style={s.cancelBtn} onClick={() => setShowForm(false)}>キャンセル</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={s.empty}>読み込み中...</div>
      ) : manufacturers.length === 0 ? (
        <div style={s.empty}>メーカーデータがありません</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>メーカー名</th>
              <th style={s.th}>Tier</th>
              <th style={s.th}>国</th>
              <th style={s.th}>設備カテゴリ</th>
              <th style={s.th}>連絡先</th>
              <th style={s.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {manufacturers.map(m => (
              <tr key={m.id} style={s.tr}>
                <td style={s.td}>{m.name}</td>
                <td style={s.td}><span style={tierBadgeStyle(m.tier)}>Tier {m.tier}</span></td>
                <td style={s.td}>{m.country}</td>
                <td style={s.td}>{m.equipmentCategories.join(', ')}</td>
                <td style={s.td}>{m.contactEmail ?? m.contactPhone ?? '-'}</td>
                <td style={s.td}>
                  {deleteConfirm === m.id ? (
                    <span style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.deleteConfirmBtn} onClick={() => handleDelete(m.id)}>削除</button>
                      <button style={s.cancelSmallBtn} onClick={() => setDeleteConfirm(null)}>取消</button>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.editBtn} onClick={() => openEdit(m)}>編集</button>
                      <button style={s.deleteBtn} onClick={() => setDeleteConfirm(m.id)}>削除</button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' } as React.CSSProperties,
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: 0 } as React.CSSProperties,
  createBtn: { backgroundColor: '#1e40af', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: '6px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 } as React.CSSProperties,
  filterRow: { display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' as const } as React.CSSProperties,
  tierButtons: { display: 'flex', gap: '0.35rem' } as React.CSSProperties,
  tierBtn: { padding: '0.3rem 0.75rem', borderRadius: '4px', border: '1px solid #2a3a5c', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, transition: 'all 0.15s' } as React.CSSProperties,
  searchInput: { backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #2a3a5c', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', flex: 1, maxWidth: '300px', fontFamily: 'inherit' } as React.CSSProperties,
  error: { color: '#f87171', fontSize: '0.8rem', marginBottom: '0.5rem' },
  form: { backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' } as React.CSSProperties,
  formTitle: { color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' } as React.CSSProperties,
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' } as React.CSSProperties,
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' } as React.CSSProperties,
  label: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 } as React.CSSProperties,
  input: { backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #2a3a5c', borderRadius: '4px', padding: '0.5rem', fontSize: '0.85rem', fontFamily: 'inherit' } as React.CSSProperties,
  formActions: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem' } as React.CSSProperties,
  submitBtn: { backgroundColor: '#166534', color: '#4ade80', border: '1px solid #22c55e', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 } as React.CSSProperties,
  cancelBtn: { backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #2a3a5c', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const } as React.CSSProperties,
  th: { textAlign: 'left' as const, padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid #2a3a5c' } as React.CSSProperties,
  tr: { borderBottom: '1px solid #1e293b' } as React.CSSProperties,
  td: { padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#e2e8f0' } as React.CSSProperties,
  editBtn: { backgroundColor: 'transparent', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' } as React.CSSProperties,
  deleteBtn: { backgroundColor: 'transparent', color: '#f87171', border: '1px solid #ef4444', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' } as React.CSSProperties,
  deleteConfirmBtn: { backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' } as React.CSSProperties,
  cancelSmallBtn: { backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #2a3a5c', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' } as React.CSSProperties,
  empty: { color: '#64748b', fontSize: '0.9rem', padding: '2rem', textAlign: 'center' as const } as React.CSSProperties,
};

function tierBadgeStyle(tier: number): React.CSSProperties {
  return {
    padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
    backgroundColor: tier === 1 ? '#1e3a5f' : tier === 2 ? '#1e3a2f' : '#3a2f1e',
    color: tier === 1 ? '#93c5fd' : tier === 2 ? '#86efac' : '#fcd34d',
  };
}
