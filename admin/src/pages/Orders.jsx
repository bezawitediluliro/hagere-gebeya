import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/client';
import styles from './TablePage.module.css';

const STATUSES = ['', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
const STATUS_COLOR = {
  PENDING: 'yellow', CONFIRMED: 'green', PREPARING: 'blue',
  READY: 'purple', DELIVERED: 'gray', CANCELLED: 'red',
};

export default function Orders() {
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['adminOrders', status],
    queryFn: () => adminApi.orders({ status: status || undefined }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }) => adminApi.updateOrderStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminOrders'] }),
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Orders</h1>
        <div className={styles.filters}>
          {STATUSES.map(s => (
            <button key={s} className={`${styles.filter} ${status === s ? styles.filterActive : ''}`}
              onClick={() => setStatus(s)}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <div className={styles.loading}>Loading...</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order #</th>
                <th>Vendor</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Update</th>
              </tr>
            </thead>
            <tbody>
              {data?.orders?.length === 0 && (
                <tr><td colSpan={8} className={styles.empty}>No orders found.</td></tr>
              )}
              {data?.orders?.map(o => (
                <tr key={o.id}>
                  <td><code className={styles.mono}>{o.orderNumber}</code></td>
                  <td className={styles.name}>{o.vendor?.name}</td>
                  <td className={styles.sub}>@{o.user?.username || o.user?.firstName || '?'}</td>
                  <td className={styles.center}>{o.items?.length}</td>
                  <td className={styles.amount}>{o.finalTotal?.toFixed(2)} ETB</td>
                  <td>
                    <span className={`${styles.badge} ${styles[`badge_${STATUS_COLOR[o.status]}`]}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className={styles.sub}>
                    {new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td>
                    <select
                      className={styles.select}
                      value={o.status}
                      onChange={e => updateMutation.mutate({ id: o.id, status: e.target.value })}
                    >
                      {['PENDING','CONFIRMED','PREPARING','READY','DELIVERED','CANCELLED'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.total > 0 && <div className={styles.count}>{data.total} order{data.total !== 1 ? 's' : ''}</div>}
        </div>
      )}
    </div>
  );
}
