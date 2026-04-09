import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import { ordersApi } from '../api/client';
import styles from './OrdersPage.module.css';

const STATUS_EMOJI = {
  PENDING: '⏳', CONFIRMED: '✅', PREPARING: '👨‍🍳',
  READY: '🎁', DELIVERED: '🏠', CANCELLED: '❌',
};
const STATUS_COLOR = {
  PENDING: '#f59e0b', CONFIRMED: '#10b981', PREPARING: '#3b82f6',
  READY: '#8b5cf6', DELIVERED: '#6b7280', CANCELLED: '#ef4444',
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list(),
  });

  if (isLoading) return <div className={styles.loading}>Loading orders...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Orders</h1>
      </div>

      {orders?.length === 0 ? (
        <div className={styles.empty}>
          <Package size={56} />
          <p>No orders yet</p>
          <button className={styles.shopBtn} onClick={() => navigate('/')}>
            Start Shopping
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {orders?.map(order => (
            <button
              key={order.id}
              className={styles.orderCard}
              onClick={() => navigate(`/orders/${order.id}`)}
            >
              <div className={styles.orderTop}>
                <span className={styles.orderNum}>#{order.orderNumber}</span>
                <span
                  className={styles.status}
                  style={{ color: STATUS_COLOR[order.status] }}
                >
                  {STATUS_EMOJI[order.status]} {order.status}
                </span>
              </div>
              <div className={styles.orderMid}>
                <span className={styles.vendorName}>{order.vendor.name}</span>
                <span className={styles.total}>{order.finalTotal.toFixed(2)} ETB</span>
              </div>
              <div className={styles.orderBot}>
                <span className={styles.itemCount}>
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </span>
                <span className={styles.date}>
                  {new Date(order.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </span>
                <ChevronRight size={16} className={styles.arrow} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
