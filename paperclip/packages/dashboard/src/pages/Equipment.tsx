import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Equipment } from '../api/client';

export function Equipment() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState({ name: '', nameJa: '', manufacturerId: '', categoryId: '', priceRange: '', leadTime: '', specs: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const filters: Record<string, string> = {};
      if (search) filters.search = search;
      const data = await api.trading.getEquipment(filters);
      setEquipment(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '設備データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', nameJa: '', manufacturerId: '', categoryId: '', priceRange: '', leadTime: '', specs: '' });
    setShowForm(true);
  };

  const openEdit = (eq: Equipment) => {
    setEditing(eq);
    setFormData({
      name: eq.name, nameJa: eq.nameJa ?? '', manufacturerId: eq.manufacturerId ?? '',
      categoryId: eq.categoryId ?? '', priceRange: eq.priceRange ?? '',
      leadTime: eq.leadTime ?? '', specs: eq.specs ? JSON.stringify(eq.specs) : '',
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
        specs: formData.specs ? JSON.parse(formData.specs) : {},
      };
      if (editing) {
        await api.trading.updateEquipment(editing.id, payload);
      } else {
        await api.trading.createEquipment(payload);
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
      await api.trading.deleteEquipment(id);
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.heading}>設備</h2>
        <button style={s.createBtn} onClick={openCreate}>+ 新規設備</button>
      </div>

      <input
        style={s.searchInput}
        placeholder="設備名で検索..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {error && <div style={s.error}>{error}</div>}

      {showForm && (
        <form style={s.form} onSubmit={handleSubmit}>
          <h3 style={s.formTitle}>{editing ? '設備編集' : '新規設備'}</h3>
          <div style={s.formGrid}>
            <div style={s.field}>
              <label style={s.label}>設備名 *</label>
              <input style={s.input} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>設備名（日本語）</label>
              <input style={s.input} value={formData.nameJa} onChange={e => setFormData({ ...formData, nameJa: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>メーカーID</label>
              <input style={s.input} value={formData.manufacturerId} onChange={e => setFormData({ ...formData, manufacturerId: e.target.value })} placeholder="UUID" />
            </div>
            <div style={s.field}>
              <label style={s.label}>カテゴリID</label>
              <input style={s.input} value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })} placeholder="UUID" />
            </div>
            <div style={s.field}>
              <label style={s.label}>価格帯</label>
              <input style={s.input} value={formData.priceRange} onChange={e => setFormData({ ...formData, priceRange: e.target.value })} placeholder="例: ¥5M〜¥10M" />
            </div>
            <div style={s.field}>
              <label style={s.label}>リードタイム</label>
              <input style={s.input} value={formData.leadTime} onChange={e => setFormData({ ...formData, leadTime: e.target.value })} placeholder="例: 3ヶ月" />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>スペック (JSON)</label>
            <textarea style={{ ...s.input, minHeight: '60px' }} value={formData.specs} onChange={e => setFormData({ ...formData, specs: e.target.value })} placeholder='例: {"capacity":"500L","power":"15kW"}' />
          </div>
          <div style={s.formActions}>
            <button type="submit" style={s.submitBtn} disabled={submitting}>{submitting ? '保存中...' : '保存'}</button>
            <button type="button" style={s.cancelBtn} onClick={() => setShowForm(false)}>キャンセル</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={s.empty}>読み込み中...</div>
      ) : equipment.length === 0 ? (
        <div style={s.empty}>設備データがありません</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>設備名</th>
              <th style={s.th}>日本語名</th>
              <th style={s.th}>価格帯</th>
              <th style={s.th}>リードタイム</th>
              <th style={s.th}>スペック</th>
              <th style={s.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {equipment.map(eq => (
              <tr key={eq.id} style={s.tr}>
                <td style={s.td}>{eq.name}</td>
                <td style={s.td}>{eq.nameJa ?? '-'}</td>
                <td style={s.td}>{eq.priceRange ?? '-'}</td>
                <td style={s.td}>{eq.leadTime ?? '-'}</td>
                <td style={s.td}>{eq.specs && Object.keys(eq.specs).length > 0 ? Object.entries(eq.specs).map(([k, v]) => `${k}: ${v}`).join(', ') : '-'}</td>
                <td style={s.td}>
                  {deleteConfirm === eq.id ? (
                    <span style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.deleteConfirmBtn} onClick={() => handleDelete(eq.id)}>削除</button>
                      <button style={s.cancelSmallBtn} onClick={() => setDeleteConfirm(null)}>取消</button>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.editBtn} onClick={() => openEdit(eq)}>編集</button>
                      <button style={s.deleteBtn} onClick={() => setDeleteConfirm(eq.id)}>削除</button>
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

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  heading: { color: '#e2e8f0', fontSize: '1.25rem', fontWeight: 600, margin: 0 },
  createBtn: { backgroundColor: '#1e40af', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: '6px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  searchInput: { backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #2a3a5c', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', width: '100%', maxWidth: '400px', marginBottom: '1rem', fontFamily: 'inherit', boxSizing: 'border-box' as const },
  error: { color: '#f87171', fontSize: '0.8rem', marginBottom: '0.5rem' },
  form: { backgroundColor: '#16213e', border: '1px solid #2a3a5c', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem' },
  formTitle: { color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem 0' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' },
  label: { color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500 },
  input: { backgroundColor: '#0f172a', color: '#e2e8f0', border: '1px solid #2a3a5c', borderRadius: '4px', padding: '0.5rem', fontSize: '0.85rem', fontFamily: 'inherit' },
  formActions: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem' },
  submitBtn: { backgroundColor: '#166534', color: '#4ade80', border: '1px solid #22c55e', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  cancelBtn: { backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #2a3a5c', borderRadius: '6px', padding: '0.5rem 1.5rem', cursor: 'pointer', fontSize: '0.85rem' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid #2a3a5c' },
  tr: { borderBottom: '1px solid #1e293b' },
  td: { padding: '0.6rem 0.75rem', fontSize: '0.85rem', color: '#e2e8f0' },
  editBtn: { backgroundColor: 'transparent', color: '#93c5fd', border: '1px solid #3b82f6', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' },
  deleteBtn: { backgroundColor: 'transparent', color: '#f87171', border: '1px solid #ef4444', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' },
  deleteConfirmBtn: { backgroundColor: '#7f1d1d', color: '#fca5a5', border: '1px solid #ef4444', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' },
  cancelSmallBtn: { backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #2a3a5c', borderRadius: '4px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' },
  empty: { color: '#64748b', fontSize: '0.9rem', padding: '2rem', textAlign: 'center' as const },
};
