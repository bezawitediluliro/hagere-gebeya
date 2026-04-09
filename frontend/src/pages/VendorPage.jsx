import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ShoppingCart, Tag, Plus, Minus } from 'lucide-react';
import { vendorsApi, cartApi } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import styles from './VendorPage.module.css';

export default function VendorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { haptic } = useTelegram();
  const [selectedCategory, setSelectedCategory] = useState('');

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => vendorsApi.get(id),
  });

  const { data: cartItems } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get(),
  });

  const addMutation = useMutation({
    mutationFn: ({ productId, quantity }) => cartApi.add(productId, quantity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      haptic('light');
    },
  });

  const cartMap = Object.fromEntries(
    (cartItems || []).map(item => [item.productId, item.quantity])
  );

  const products = vendor?.products || [];
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const filtered = selectedCategory
    ? products.filter(p => p.category === selectedCategory)
    : products;

  const totalCartItems = (cartItems || []).reduce((sum, i) => sum + i.quantity, 0);

  if (isLoading) return <div className={styles.loading}>Loading...</div>;
  if (!vendor) return <div className={styles.loading}>Vendor not found</div>;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div className={styles.headerInfo}>
          <div className={styles.avatar}>
            {vendor.logoUrl
              ? <img src={vendor.logoUrl} alt={vendor.name} />
              : <span>{vendor.name[0]}</span>
            }
          </div>
          <div>
            <h1 className={styles.name}>{vendor.name}</h1>
            {vendor.category && <p className={styles.meta}>{vendor.category}</p>}
            {vendor.description && <p className={styles.desc}>{vendor.description}</p>}
          </div>
        </div>
        <button className={styles.cartBtn} onClick={() => navigate('/cart')}>
          <ShoppingCart size={22} />
          {totalCartItems > 0 && <span className={styles.badge}>{totalCartItems}</span>}
        </button>
      </div>

      {/* Discounts banner */}
      {vendor.discounts?.length > 0 && (
        <div className={styles.discountBanner}>
          <Tag size={14} />
          <span>Discount codes available: {vendor.discounts.map(d => d.code).join(', ')}</span>
        </div>
      )}

      {/* Category filter */}
      {categories.length > 0 && (
        <div className={styles.cats}>
          <button
            className={`${styles.cat} ${!selectedCategory ? styles.catActive : ''}`}
            onClick={() => setSelectedCategory('')}
          >All</button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`${styles.cat} ${selectedCategory === cat ? styles.catActive : ''}`}
              onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
            >{cat}</button>
          ))}
        </div>
      )}

      {/* Products */}
      <div className={styles.products}>
        {filtered.map(product => {
          const qty = cartMap[product.id] || 0;
          return (
            <div key={product.id} className={styles.product}>
              {product.imageUrl && (
                <img
                  className={styles.productImg}
                  src={product.imageUrl}
                  alt={product.name}
                  onClick={() => navigate(`/product/${product.id}`)}
                />
              )}
              <div className={styles.productBody}>
                <div
                  className={styles.productName}
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  {product.name}
                </div>
                {product.description && (
                  <div className={styles.productDesc}>{product.description}</div>
                )}
                <div className={styles.productFooter}>
                  <div className={styles.price}>{product.price.toFixed(2)} ETB</div>
                  {product.stock === 0 ? (
                    <span className={styles.outOfStock}>Out of stock</span>
                  ) : qty === 0 ? (
                    <button
                      className={styles.addBtn}
                      onClick={() => addMutation.mutate({ productId: product.id, quantity: 1 })}
                      disabled={addMutation.isPending}
                    >
                      <Plus size={18} /> Add
                    </button>
                  ) : (
                    <div className={styles.qtyControl}>
                      <button
                        className={styles.qtyBtn}
                        onClick={() => addMutation.mutate({ productId: product.id, quantity: qty - 1 === 0 ? undefined : qty - 1 })}
                      >
                        <Minus size={16} />
                      </button>
                      <span className={styles.qty}>{qty}</span>
                      <button
                        className={styles.qtyBtn}
                        onClick={() => addMutation.mutate({ productId: product.id, quantity: qty + 1 })}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky checkout bar */}
      {totalCartItems > 0 && (
        <div className={styles.checkoutBar}>
          <button className={styles.checkoutBtn} onClick={() => navigate('/cart')}>
            <ShoppingCart size={18} />
            View Cart ({totalCartItems} items)
          </button>
        </div>
      )}
    </div>
  );
}
