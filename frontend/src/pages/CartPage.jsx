import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Trash2, ShoppingCart, Plus, Minus, ArrowLeft } from 'lucide-react';
import { cartApi } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import styles from './CartPage.module.css';

export default function CartPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { haptic } = useTelegram();

  const { data: cartItems, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, quantity }) =>
      quantity <= 0 ? cartApi.remove(productId) : cartApi.add(productId, quantity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      haptic('light');
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cart'] }),
  });

  // Group by vendor
  const grouped = (cartItems || []).reduce((acc, item) => {
    const vid = item.product.vendor.id;
    if (!acc[vid]) acc[vid] = { vendor: item.product.vendor, items: [] };
    acc[vid].items.push(item);
    return acc;
  }, {});

  const groups = Object.values(grouped);
  const grandTotal = (cartItems || []).reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  if (isLoading) return <div className={styles.loading}>Loading cart...</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1 className={styles.title}>My Cart</h1>
        {cartItems?.length > 0 && (
          <button className={styles.clearBtn} onClick={() => clearMutation.mutate()}>
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {cartItems?.length === 0 ? (
        <div className={styles.empty}>
          <ShoppingCart size={56} />
          <p>Your cart is empty</p>
          <button className={styles.shopBtn} onClick={() => navigate('/')}>
            Browse Vendors
          </button>
        </div>
      ) : (
        <>
          {groups.map(({ vendor, items }) => {
            const vendorTotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
            return (
              <div key={vendor.id} className={styles.group}>
                <div className={styles.vendorHeader}>
                  <span className={styles.vendorName}>{vendor.name}</span>
                  <button
                    className={styles.checkoutVendorBtn}
                    onClick={() => navigate('/checkout', { state: { vendorId: vendor.id } })}
                  >
                    Order ({vendorTotal.toFixed(0)} ETB)
                  </button>
                </div>

                {items.map(item => (
                  <div key={item.id} className={styles.item}>
                    {item.product.imageUrl && (
                      <img className={styles.img} src={item.product.imageUrl} alt={item.product.name} />
                    )}
                    <div className={styles.info}>
                      <div className={styles.itemName}>{item.product.name}</div>
                      <div className={styles.itemPrice}>
                        {(item.product.price * item.quantity).toFixed(2)} ETB
                      </div>
                    </div>
                    <div className={styles.qtyControl}>
                      <button
                        className={styles.qtyBtn}
                        onClick={() => updateMutation.mutate({ productId: item.productId, quantity: item.quantity - 1 })}
                      >
                        <Minus size={16} />
                      </button>
                      <span className={styles.qty}>{item.quantity}</span>
                      <button
                        className={styles.qtyBtn}
                        onClick={() => updateMutation.mutate({ productId: item.productId, quantity: item.quantity + 1 })}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span>Grand Total</span>
              <span className={styles.grandTotal}>{grandTotal.toFixed(2)} ETB</span>
            </div>
            {groups.length === 1 && (
              <button
                className={styles.checkoutBtn}
                onClick={() => navigate('/checkout', { state: { vendorId: groups[0].vendor.id } })}
              >
                Proceed to Checkout
              </button>
            )}
            {groups.length > 1 && (
              <p className={styles.multiVendorNote}>
                You have items from {groups.length} vendors. Checkout each vendor separately.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
