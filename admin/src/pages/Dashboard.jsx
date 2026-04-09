import { useQuery } from '@tanstack/react-query';
import { Users, Store, Package, DollarSign } from 'lucide-react';
import { adminApi } from '../api/client';
import StatCard from '../components/StatCard';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: () => adminApi.stats(),
    refetchInterval: 30000,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ['adminOrders', { limit: 5 }],
    queryFn: () => adminApi.orders({ limit: 5 }),
  });

  const { data: pendingVendors } = useQuery({
    queryKey: ['adminVendors', { approved: false }],
    queryFn: () => adminApi.vendors({ approved: false, limit: 5 }),
  });

  const STATUS_COLOR = {
    PENDING: '#f59e0b', CONFIRMED: '#10b981', PREPARING: '#3b82f6',
    READY: '#8b5cf6', DELIVERED: '#6b7280', CANCELLED: '#ef4444',
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Dashboard</h1>

      {isLoading ? (
        <div className={styles.grid}>
          {[1,2,3,4].map(i => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : (
        <div className={styles.grid}>
          <StatCard icon={<Users size={22} />} label="Total Users" value={stats?.users} color="blue" />
          <StatCard icon={<Store size={22} />} label="Active Vendors" value={stats?.vendors?.approved}
            sub={stats?.vendors?.pending > 0 ? `${stats.vendors.pending} pending approval` : undefined} color="green" />
          <StatCard icon={<Package size={22} />} label="Today's Orders" value={stats?.orders?.today}
            sub={`${stats?.orders?.total} total`} color="orange" />
          <StatCard icon={<DollarSign size={22} />} label="Total Revenue"
            value={stats?.revenue ? `${stats.revenue.toFixed(0)} ETB` : '0 ETB'} color="purple" />
        </div>
      )}

      <div className={styles.row}>
        {/* Pending vendors */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>⏳ Pending Vendor Approvals</div>
          {pendingVendors?.vendors?.length === 0 && (
            <p className={styles.empty}>All caught up!</p>
          )}
          {pendingVendors?.vendors?.map(v => (
            <div key={v.id} className={styles.listItem}>
              <div>
                <div className={styles.itemName}>{v.name}</div>
                <div className={styles.itemSub}>{v.category || 'No category'} · @{v.owner?.username || v.owner?.firstName}</div>
              </div>
              <div className={styles.itemActions}>
                <ApproveVendorBtn vendorId={v.id} approved />
                <ApproveVendorBtn vendorId={v.id} />
              </div>
            </div>
          ))}
        </div>

        {/* Recent orders */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>📦 Recent Orders</div>
          {recentOrders?.orders?.length === 0 && (
            <p className={styles.empty}>No orders yet.</p>
          )}
          {recentOrders?.orders?.map(o => (
            <div key={o.id} className={styles.listItem}>
              <div>
                <div className={styles.itemName}>#{o.orderNumber}</div>
                <div className={styles.itemSub}>{o.vendor?.name} · {o.finalTotal?.toFixed(2)} ETB</div>
              </div>
              <span className={styles.statusBadge} style={{ background: STATUS_COLOR[o.status] + '22', color: STATUS_COLOR[o.status] }}>
                {o.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

