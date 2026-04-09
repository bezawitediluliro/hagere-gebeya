import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { adminApi } from '../api/client';
import styles from './TablePage.module.css';

export default function Vendors() {
  const [filter, setFilter] = useState('all');
  const qc = useQueryClient();

  const params = filter === 'pending' ? { approved: false }
    : filter === 'approved' ? { approved: true } : {};

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adminVendors', filter],
    queryFn: () => adminApi.vendors(params),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => adminApi.updateVendor(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminVendors'] }),
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Vendors</h1>
        <div className={styles.filters}>
          {['all', 'pending', 'approved'].map(f => (
            <button key={f} className={`${styles.filter} ${filter === f ? styles.filterActive : ''}`}
              onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <div className={styles.loading}>Loading...</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Shop</th>
                <th>Category</th>
                <th>Owner</th>
                <th>Products</th>
                <th>Orders</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.vendors?.length === 0 && (
                <tr><td colSpan={7} className={styles.empty}>No vendors found.</td></tr>
              )}
              {data?.vendors?.map(v => (
                <tr key={v.id}>
                  <td>
                    <div className={styles.nameCell}>
                      <div className={styles.avatar}>{v.name[0]}</div>
                      <div>
                        <div className={styles.name}>{v.name}</div>
                        {v.phone && <div className={styles.sub}>{v.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td><span className={styles.tag}>{v.category || '—'}</span></td>
                  <td className={styles.sub}>@{v.owner?.username || v.owner?.firstName || '?'}</td>
                  <td className={styles.center}>{v._count?.products || 0}</td>
                  <td className={styles.center}>{v._count?.orders || 0}</td>
                  <td>
                    <span className={`${styles.badge} ${v.approved ? styles.badgeGreen : styles.badgeYellow}`}>
                      {v.approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {!v.approved && (
                        <button
                          className={styles.actionBtn}
                          title="Approve"
                          onClick={() => updateMutation.mutate({ id: v.id, data: { approved: true } })}
                        >
                          <CheckCircle size={16} color="#16a34a" />
                        </button>
                      )}
                      {v.approved && (
                        <button
                          className={styles.actionBtn}
                          title="Revoke"
                          onClick={() => updateMutation.mutate({ id: v.id, data: { approved: false } })}
                        >
                          <XCircle size={16} color="#dc2626" />
                        </button>
                      )}
                      <button
                        className={styles.actionBtn}
                        title={v.active ? 'Deactivate' : 'Activate'}
                        onClick={() => updateMutation.mutate({ id: v.id, data: { active: !v.active } })}
                      >
                        {v.active ? <EyeOff size={16} color="#64748b" /> : <Eye size={16} color="#64748b" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.total > 0 && (
            <div className={styles.count}>{data.total} vendor{data.total !== 1 ? 's' : ''}</div>
          )}
        </div>
      )}
    </div>
  );
}
