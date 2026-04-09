import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Tag, MapPin, FileText, CheckCircle } from 'lucide-react';
import { cartApi, ordersApi, discountsApi } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import styles from './CheckoutPage.module.css';

export default function CheckoutPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { haptic, showAlert } = useTelegram();
  const vendorId = state?.vendorId;

  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [codeError, setCodeError] = useState('');
  const [placed, setPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  const { data: cartItems } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get(),
  });

  const vendorItems = (cartItems || []).filter(i => i.product.vendor.id === vendorId);
  const subtotal = vendorItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const discountAmount = appliedDiscount
    ? appliedDiscount.type === 'PERCENTAGE'
      ? (subtotal * appliedDiscount.value) / 100
      : appliedDiscount.value
    : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const validateDiscount = useMutation({
    mutationFn: () => discountsApi.validate({ code: discountCode, vendorId, orderTotal: subtotal }),
    onSuccess: (data) => {
      setAppliedDiscount(data.discount);
      setCodeError('');
      haptic('medium');
    },
    onError: (err) => {
      setCodeError(err.message);
      setAppliedDiscount(null);
    },
  });

  const placeMutation = useMutation({
    mutationFn: () => ordersApi.place({
      vendorId,
      discountCode: appliedDiscount ? appliedDiscount.code : undefined,
      address: address || undefined,
      notes: notes || undefined,
      paymentMethod,
    }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      haptic('success');
      setPlaced(true);
      setPlacedOrder(order);
    },
    onError: (err) => showAlert(err.message),
  });

  if (!vendorId) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <h1 className={styles.title}>Checkout</h1>
        </div>
        <div className={styles.empty}>Invalid checkout. <button onClick={() => navigate('/cart')}>Go to cart</button></div>
      </div>
    );
  }

  if (placed) {
    return (
      <div className={styles.success}>
        <CheckCircle size={64} className={styles.successIcon} />
        <h2>Order Placed!</h2>
        <p className={styles.orderNum}>#{placedOrder?.orderNumber}</p>
        <p className={styles.successMsg}>Your vendor has been notified. You'll get updates via Telegram!</p>
        <button className={styles.trackBtn} onClick={() => navigate('/orders')}>
          Track Orders
        </button>
      </div>
    );
  }

  if (vendorItems.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <h1 className={styles.title}>Checkout</h1>
        </div>
        <div className={styles.empty}>No items for this vendor. <button onClick={() => navigate('/cart')}>Go to cart</button></div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1 className={styles.title}>Checkout</h1>
      </div>

      {/* Order items summary */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Order Summary</div>
        {vendorItems.map(item => (
          <div key={item.id} className={styles.orderItem}>
            <span className={styles.itemName}>{item.product.name} × {item.quantity}</span>
            <span className={styles.itemPrice}>{(item.product.price * item.quantity).toFixed(2)} ETB</span>
          </div>
        ))}
      </div>

      {/* Discount code */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}><Tag size={14} /> Discount Code</div>
        <div className={styles.discountRow}>
          <input
            className={styles.input}
            placeholder="Enter code (e.g. WELCOME10)"
            value={discountCode}
            onChange={e => { setDiscountCode(e.target.value.toUpperCase()); setCodeError(''); setAppliedDiscount(null); }}
          />
          <button
            className={styles.applyBtn}
            onClick={() => validateDiscount.mutate()}
            disabled={!discountCode || validateDiscount.isPending}
          >Apply</button>
        </div>
        {codeError && <p className={styles.error}>{codeError}</p>}
        {appliedDiscount && (
          <p className={styles.discountSuccess}>
            ✅ -{appliedDiscount.type === 'PERCENTAGE' ? `${appliedDiscount.value}%` : `${appliedDiscount.value} ETB`} applied!
          </p>
        )}
      </div>

      {/* Delivery address */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}><MapPin size={14} /> Delivery Address</div>
        <textarea
          className={styles.textarea}
          placeholder="Enter your delivery address or leave blank for pickup"
          value={address}
          onChange={e => setAddress(e.target.value)}
          rows={2}
        />
      </div>

      {/* Notes */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}><FileText size={14} /> Notes (optional)</div>
        <textarea
          className={styles.textarea}
          placeholder="Any special instructions..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      {/* Payment method */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Payment Method</div>
        <div className={styles.paymentMethods}>
          <button
            className={`${styles.payMethod} ${paymentMethod === 'CASH' ? styles.payActive : ''}`}
            onClick={() => setPaymentMethod('CASH')}
          >
            💵 Cash on Delivery
          </button>
          <button
            className={`${styles.payMethod} ${paymentMethod === 'TELEBIRR' ? styles.payActive : ''} ${styles.payDisabled}`}
            disabled
            title="Coming soon"
          >
            📱 TeleBirr (Coming Soon)
          </button>
        </div>
      </div>

      {/* Price summary */}
      <div className={styles.priceSummary}>
        <div className={styles.priceRow}>
          <span>Subtotal</span><span>{subtotal.toFixed(2)} ETB</span>
        </div>
        {discountAmount > 0 && (
          <div className={`${styles.priceRow} ${styles.discountRow2}`}>
            <span>Discount</span><span>-{discountAmount.toFixed(2)} ETB</span>
          </div>
        )}
        <div className={`${styles.priceRow} ${styles.totalRow}`}>
          <span>Total</span><span>{total.toFixed(2)} ETB</span>
        </div>
      </div>

      <div className={styles.placeWrap}>
        <button
          className={styles.placeBtn}
          onClick={() => placeMutation.mutate()}
          disabled={placeMutation.isPending}
        >
          {placeMutation.isPending ? 'Placing Order...' : `Place Order — ${total.toFixed(2)} ETB`}
        </button>
      </div>
    </div>
  );
}
