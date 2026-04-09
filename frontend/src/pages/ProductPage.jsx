import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShoppingCart, Plus, Minus, Store } from 'lucide-react';
import { productsApi, cartApi } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import styles from './ProductPage.module.css';

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { haptic } = useTelegram();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(id),
  });

  const { data: cartItems } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get(),
  });

  const cartItem = cartItems?.find(i => i.productId === parseInt(id));
  const qty = cartItem?.quantity || 0;

  const updateCart = useMutation({
    mutationFn: ({ quantity }) =>
      quantity <= 0 ? cartApi.remove(parseInt(id)) : cartApi.add(parseInt(id), quantity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      haptic('light');
    },
  });

  if (isLoading) return <div className={styles.loading}>Loading...</div>;
  if (!product) return <div className={styles.loading}>Product not found</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <button className={styles.cartBtn} onClick={() => navigate('/cart')}>
          <ShoppingCart size={22} />
        </button>
      </div>

      {product.imageUrl
        ? <img className={styles.image} src={product.imageUrl} alt={product.name} />
        : <div className={styles.imagePlaceholder}>{product.name[0]}</div>
      }

      <div className={styles.body}>
        <div className={styles.categoryBadge}>{product.category || 'General'}</div>
        <h1 className={styles.name}>{product.name}</h1>
        <div className={styles.price}>{product.price.toFixed(2)} ETB</div>

        {product.description && <p className={styles.desc}>{product.description}</p>}

        <button
          className={styles.vendorLink}
          onClick={() => navigate(`/vendor/${product.vendor.id}`)}
        >
          <Store size={15} />
          <span>{product.vendor.name}</span>
        </button>

        <div className={styles.stockInfo}>
          {product.stock === 0
            ? <span className={styles.outOfStock}>Out of stock</span>
            : <span className={styles.inStock}>In stock ({product.stock} available)</span>
          }
        </div>
      </div>

      {product.stock > 0 && (
        <div className={styles.addBar}>
          {qty === 0 ? (
            <button
              className={styles.addBtn}
              onClick={() => updateCart.mutate({ quantity: 1 })}
              disabled={updateCart.isPending}
            >
              <ShoppingCart size={18} /> Add to Cart
            </button>
          ) : (
            <div className={styles.qtyRow}>
              <button className={styles.qtyBtn} onClick={() => updateCart.mutate({ quantity: qty - 1 })}>
                <Minus size={18} />
              </button>
              <span className={styles.qty}>{qty} in cart</span>
              <button className={styles.qtyBtn} onClick={() => updateCart.mutate({ quantity: qty + 1 })}>
                <Plus size={18} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
