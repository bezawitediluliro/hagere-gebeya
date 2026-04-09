import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MapPin, FileText, CreditCard } from 'lucide-react';
import { ordersApi } from '../api/client';
import styles from './OrderDetailPage.module.css';

const STATUS_STEPS = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED'];
const STATUS_LABEL = {
  PENDING: 'Order Placed', CONFIRMED: 'Confirmed', PREPARING: 'Preparing',
  READY: 'Ready', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.get(id),
    refetchInterval: 15000,
  });

  if (isLoading) return <div className={styles.loading}>Loading...</div>;
  if (!order) return <div className={styles.loading}>Order not found</div>;

  const isCancelled = order.status === 'CANCELLED';
  const currentStep = isCancelled ? -1 : STATUS_STEPS.indexOf(order.status);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1 className={styles.title}>Order Details</h1>
      </div>

      {/* Order number & vendor */}
      <div className={styles.topCard}>
        <div className={styles.orderNum}>#{order.orderNumber}</div>
        <div className={styles.vendorName}>{order.vendor.name}</div>
        <div className={styles.orderDate}>
          {new Date(order.createdAt).toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </div>
      </div>

      {/* Status tracker */}
      {isCancelled ? (
        <div className={styles.cancelledBanner}>❌ This order was cancelled</div>
      ) : (
        <div className={styles.tracker}>
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className={styles.trackerStep}>
              <div className={`${styles.dot} ${i <= currentStep ? styles.dotActive : ''}`}>
                {i < currentStep ? '✓' : i === currentStep ? '●' : '○'}
              </div>
              <div className={`${styles.stepLabel} ${i <= currentStep ? styles.stepActive : ''}`}>
                {STATUS_LABEL[step]}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`${styles.line} ${i < currentStep ? styles.lineActive : ''}`} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Items */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Items</div>
        {order.items.map(item => (
          <div key={item.id} className={styles.item}>
            {item.product.imageUrl && (
              <img className={styles.img} src={item.product.imageUrl} alt={item.product.name} />
            )}
            <div className={styles.itemInfo}>
              <div className={styles.itemName}>{item.product.name}</div>
              <div className={styles.itemUnit}>{item.price.toFixed(2)} ETB × {item.quantity}</div>
            </div>
            <div className={styles.itemTotal}>{(item.price * item.quantity).toFixed(2)} ETB</div>
          </div>
        ))}
      </div>

      {/* Price breakdown */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Payment</div>
        <div className={styles.priceRow}>
          <span>Subtotal</span><span>{order.total.toFixed(2)} ETB</span>
        </div>
        {order.discount > 0 && (
          <div className={`${styles.priceRow} ${styles.discountRow}`}>
            <span>Discount</span><span>-{order.discount.toFixed(2)} ETB</span>
          </div>
        )}
        <div className={`${styles.priceRow} ${styles.totalRow}`}>
          <span>Total</span><span>{order.finalTotal.toFixed(2)} ETB</span>
        </div>
        <div className={styles.payRow}>
          <CreditCard size={14} />
          <span>{order.payment?.method || 'CASH'}</span>
          <span className={styles.payStatus}>{order.payment?.status || 'PENDING'}</span>
        </div>
      </div>

      {/* Delivery info */}
      {(order.address || order.notes) && (
        <div className={styles.section}>
          {order.address && (
            <div className={styles.infoRow}>
              <MapPin size={14} />
              <span>{order.address}</span>
            </div>
          )}
          {order.notes && (
            <div className={styles.infoRow}>
              <FileText size={14} />
              <span>{order.notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
