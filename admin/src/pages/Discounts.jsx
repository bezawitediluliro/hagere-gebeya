import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { adminApi } from '../api/client';
import styles from './TablePage.module.css';

export default function Discounts() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', type: 'PERCENTAGE', value: '', minOrder: '', maxUses: '', expiresAt: '' });

  const { data: discounts, isLoading } = useQuery({
    queryKey: ['adminDiscounts'],
    queryFn: () => adminApi.discounts(),
  });

  const createMutation = useMutation({
    mutationFn: () => adminApi.createDiscount({
      ...form,
      value: parseFloat(form.value),
      minOrder: form.minOrder ? parseFloat(form.minOrder) : undefined,
      maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
      expiresAt: form.expiresAt || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminDiscounts'] });
      setShowForm(false);
      setForm({ code: '', type: 'PERCENTAGE', value: '', minOrder: '', maxUses: '', expiresAt: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => adminApi.deleteDiscount(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminDiscounts'] }),
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Discount Codes</h1>
        <button className={styles.addBtn} onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> New Code
        </button>
      </div>

      {showForm && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Create Discount Code</h2>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label>Code *</label>
              <input className={styles.input} placeholder="e.g. SAVE20"
                value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
            <div className={styles.formGroup}>
              <label>Type *</label>
              <select className={styles.input} value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (ETB)</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label>Value *</label>
              <input className={styles.input} type="number" placeholder={form.type === 'PERCENTAGE' ? '% off' : 'ETB off'}
                value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label>Min Order (ETB)</label>
              <input className={styles.input} type="number" placeholder="Optional"
                value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label>Max Uses</label>
              <input className={styles.input} type="number" placeholder="Optional (blank = unlimited)"
                value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))} />
            </div>
            <div className={styles.formGroup}>
              <label>Expires At</label>
              <input className={styles.input} type="datetime-local"
                value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
            </div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.submitBtn}
              onClick={() => createMutation.mutate()}
              disabled={!form.code || !form.value || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Code'}
            </button>
            <button className={styles.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          {createMutation.isError && <p className={styles.error}>{createMutation.error.message}</p>}
        </div>
      )}

      {isLoading ? <div className={styles.loading}>Loading...</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Vendor</th>
                <th>Min Order</th>
                <th>Uses</th>
                <th>Expires</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {discounts?.length === 0 && (
                <tr><td colSpan={8} className={styles.empty}>No discount codes yet.</td></tr>
              )}
              {discounts?.map(d => (
                <tr key={d.id}>
                  <td><code className={styles.mono}>{d.code}</code></td>
                  <td className={styles.amount}>
                    {d.type === 'PERCENTAGE' ? `${d.value}%` : `${d.value} ETB`}
                  </td>
                  <td className={styles.sub}>{d.vendor?.name || 'Global'}</td>
                  <td className={styles.sub}>{d.minOrder ? `${d.minOrder} ETB` : '—'}</td>
                  <td className={styles.center}>{d.usedCount}/{d.maxUses || '∞'}</td>
                  <td className={styles.sub}>
                    {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${d.active ? styles.badge_green : styles.badge_gray}`}>
                      {d.active ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <button className={styles.dangerBtn}
                      onClick={() => deleteMutation.mutate(d.id)}>
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
