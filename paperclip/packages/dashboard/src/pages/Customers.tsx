import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import type { Customer } from '../api/client';

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', contactName: '', email: '', phone: '', industry: '', address: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.trading.getCustomers();
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '顧客データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contactName ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', contactName: '', email: '', phone: '', industry: '', address: '', notes: '' });
    setShowForm(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setFormData({ name: c.name, contactName: c.contactName ?? '', email: c.email ?? '', phone: c.phone ?? '', industry: c.industry ?? '', address: c.address ?? '', notes: c.notes ?? '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      if (editing) {
        await api.trading.updateCustomer(editing.id, formData);
      } else {
        await api.trading.createCustomer(formData);
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
      await api.trading.deleteCustomer(id);
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.heading}>顧客</h2>
        <button style={s.createBtn} onClick={openCreate}>+ 新規顧客</button>
      </div>

      <input
        style={s.searchInput}
        placeholder="顧客名、担当者、メールで検索..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {error && <div style={s.error}>{error}</div>}

      {showForm && (
        <form style={s.form} onSubmit={handleSubmit}>
          <h3 style={s.formTitle}>{editing ? '顧客編集' : '新規顧客'}</h3>
          <div style={s.formGrid}>
            <div style={s.field}>
              <label style={s.label}>顧客名 *</label>
              <input style={s.input} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>担当者</label>
              <input style={s.input} value={formData.contactName} onChange={e => setFormData({ ...formData, contactName: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>メール</label>
              <input style={s.input} type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>電話</label>
              <input style={s.input} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>業種</label>
              <input style={s.input} value={formData.industry} onChange={e => setFormData({ ...formData, industry: e.target.value })} />
            </div>
            <div style={s.field}>
              <label style={s.label}>住所</label>
              <input style={s.input} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>メモ</label>
            <textarea style={{ ...s.input, minHeight: '60px' }} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
          </div>
          <div style={s.formActions}>
            <button type="submit" style={s.submitBtn} disabled={submitting}>{submitting ? '保存中...' : '保存'}</button>
            <button type="button" style={s.cancelBtn} onClick={() => setShowForm(false)}>キャンセル</button>
          </div>
        </form>
      )}

      {loading ? (
        <div style={s.empty}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>{search ? '該当する顧客が見つかりません' : '顧客データがありません'}</div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>顧客名</th>
              <th style={s.th}>担当者</th>
              <th style={s.th}>メール</th>
              <th style={s.th}>電話</th>
              <th style={s.th}>業種</th>
              <th style={s.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={s.tr}>
                <td style={s.td}>{c.name}</td>
                <td style={s.td}>{c.contactName}</td>
                <td style={s.td}>{c.email}</td>
                <td style={s.td}>{c.phone}</td>
                <td style={s.td}>{c.industry}</td>
                <td style={s.td}>
                  {deleteConfirm === c.id ? (
                    <span style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.deleteConfirmBtn} onClick={() => handleDelete(c.id)}>削除</button>
                      <button style={s.cancelSmallBtn} onClick={() => setDeleteConfirm(null)}>取消</button>
                    </span>
                  ) : (
                    <span style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={s.editBtn} onClick={() => openEdit(c)}>編集</button>
                      <button style={s.deleteBtn} onClick={() => setDeleteConfirm(c.id)}>削除</button>
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
