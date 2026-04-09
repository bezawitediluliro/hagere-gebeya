import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Package, Tag, BarChart2 } from 'lucide-react';
import api, { userApi } from '../api/client';
import styles from './VendorDashboard.module.css';

export default function VendorDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('orders');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', description: '', category: '', stock: '' });
  const [dcForm, setDcForm] = useState({ code: '', type: 'PERCENTAGE', value: '', minOrder: '', maxUses: '' });

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => userApi.me() });
  const vendor = me?.vendor;

  const { data: orders } = useQuery({
    queryKey: ['vendorOrders', vendor?.id],
    queryFn: () => api.get(`/vendors/${vendor.id}/orders`),
    enabled: !!vendor?.id && tab === 'orders',
  });

  const { data: products } = useQuery({
    queryKey: ['vendorProducts', vendor?.id],
    queryFn: () => api.get(`/vendors/${vendor.id}/products`),
    enabled: !!vendor?.id && tab === 'products',
  });

  const { data: discounts } = useQuery({
    queryKey: ['vendorDiscounts', vendor?.id],
    queryFn: () => api.get(`/vendors/${vendor.id}/discounts`),
    enabled: !!vendor?.id && tab === 'discounts',
  });

  const addProductMutation = useMutation({
    mutationFn: () => api.post(`/vendors/${vendor.id}/products`, {
      ...form, price: parseFloat(form.price), stock: form.stock ? parseInt(form.stock) : 999,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendorProducts'] });
      setShowAddProduct(false);
      setForm({ name: '', price: '', description: '', category: '', stock: '' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }) =>
      api.patch(`/vendors/${vendor.id}/orders/${orderId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendorOrders'] }),
  });

  const addDiscountMutation = useMutation({
    mutationFn: () => api.post(`/vendors/${vendor.id}/discounts`, {
      ...dcForm, value: parseFloat(dcForm.value),
      minOrder: dcForm.minOrder ? parseFloat(dcForm.minOrder) : undefined,
      maxUses: dcForm.maxUses ? parseInt(dcForm.maxUses) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendorDiscounts'] });
      setShowAddDiscount(false);
      setDcForm({ code: '', type: 'PERCENTAGE', value: '', minOrder: '', maxUses: '' });
    },
  });

  if (!vendor) {
    return <VendorApplyForm />;
  }

  if (!vendor.approved) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button className={styles.back} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
          <h1 className={styles.title}>Vendor Dashboard</h1>
        </div>
        <div className={styles.pending}>
          <Package size={48} />
          <h2>Application Pending</h2>
          <p>Your shop "{vendor.name}" is under review. We'll notify you once approved!</p>
        </div>
      </div>
    );
  }

  const STATUS_NEXT = { PENDING: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'READY', READY: 'DELIVERED' };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>{vendor.name}</h1>
          <span className={styles.approved}>✅ Active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {[['orders', Package, 'Orders'], ['products', BarChart2, 'Products'], ['discounts', Tag, 'Discounts']].map(([key, Icon, label]) => (
          <button key={key} className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`} onClick={() => setTab(key)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className={styles.content}>
          {!orders?.length && <p className={styles.empty}>No orders yet.</p>}
          {orders?.map(order => (
            <div key={order.id} className={styles.orderCard}>
              <div className={styles.orderTop}>
                <span className={styles.orderNum}>#{order.orderNumber}</span>
                <span className={`${styles.status} ${styles[`status_${order.status}`]}`}>{order.status}</span>
              </div>
              <div className={styles.orderItems}>
                {order.items.map(i => <span key={i.id}>{i.product.name} ×{i.quantity}</span>)}
              </div>
              <div className={styles.orderBottom}>
                <span className={styles.orderTotal}>{order.finalTotal.toFixed(2)} ETB</span>
                {STATUS_NEXT[order.status] && (
                  <button
                    className={styles.nextBtn}
                    onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: STATUS_NEXT[order.status] })}
                  >
                    Mark {STATUS_NEXT[order.status]}
                  </button>
                )}
                {order.status === 'PENDING' && (
                  <button
                    className={styles.cancelBtn}
                    onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'CANCELLED' })}
                  >Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Products tab */}
      {tab === 'products' && (
        <div className={styles.content}>
          <button className={styles.addBtn} onClick={() => setShowAddProduct(true)}>
            <Plus size={16} /> Add Product
          </button>
          {showAddProduct && (
            <div className={styles.form}>
              <div className={styles.formTitle}>New Product</div>
              {[['name', 'Name *'], ['price', 'Price (ETB) *'], ['category', 'Category'], ['stock', 'Stock (blank = unlimited)']].map(([key, label]) => (
                <input key={key} className={styles.input} placeholder={label}
                  value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              ))}
              <textarea className={styles.textarea} placeholder="Description" rows={2}
                value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              <div className={styles.formBtns}>
                <button className={styles.submitBtn} onClick={() => addProductMutation.mutate()}
                  disabled={!form.name || !form.price || addProductMutation.isPending}>
                  {addProductMutation.isPending ? 'Adding...' : 'Add Product'}
                </button>
                <button className={styles.cancelFormBtn} onClick={() => setShowAddProduct(false)}>Cancel</button>
              </div>
            </div>
          )}
          {products?.map(p => (
            <div key={p.id} className={styles.productItem}>
              <div className={styles.productInfo}>
                <span className={styles.productName}>{p.name}</span>
                <span className={styles.productPrice}>{p.price.toFixed(2)} ETB</span>
              </div>
              <span className={styles.productStock}>{p.stock === 999 ? '∞' : p.stock} in stock</span>
            </div>
          ))}
        </div>
      )}

      {/* Discounts tab */}
      {tab === 'discounts' && (
        <div className={styles.content}>
          <button className={styles.addBtn} onClick={() => setShowAddDiscount(true)}>
            <Plus size={16} /> Create Discount Code
          </button>
          {showAddDiscount && (
            <div className={styles.form}>
              <div className={styles.formTitle}>New Discount Code</div>
              <input className={styles.input} placeholder="Code (e.g. SUMMER20)"
                value={dcForm.code} onChange={e => setDcForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
              <select className={styles.input} value={dcForm.type}
                onChange={e => setDcForm(f => ({ ...f, type: e.target.value }))}>
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (ETB)</option>
              </select>
              <input className={styles.input} placeholder={`Value (${dcForm.type === 'PERCENTAGE' ? '%' : 'ETB'})`}
                type="number" value={dcForm.value} onChange={e => setDcForm(f => ({ ...f, value: e.target.value }))} />
              <input className={styles.input} placeholder="Min order (optional)"
                type="number" value={dcForm.minOrder} onChange={e => setDcForm(f => ({ ...f, minOrder: e.target.value }))} />
              <input className={styles.input} placeholder="Max uses (optional)"
                type="number" value={dcForm.maxUses} onChange={e => setDcForm(f => ({ ...f, maxUses: e.target.value }))} />
              <div className={styles.formBtns}>
                <button className={styles.submitBtn} onClick={() => addDiscountMutation.mutate()}
                  disabled={!dcForm.code || !dcForm.value || addDiscountMutation.isPending}>
                  {addDiscountMutation.isPending ? 'Creating...' : 'Create Code'}
                </button>
                <button className={styles.cancelFormBtn} onClick={() => setShowAddDiscount(false)}>Cancel</button>
              </div>
            </div>
          )}
          {discounts?.map(d => (
            <div key={d.id} className={styles.discountItem}>
              <span className={styles.dcCode}>{d.code}</span>
              <span className={styles.dcValue}>
                {d.type === 'PERCENTAGE' ? `${d.value}% off` : `${d.value} ETB off`}
              </span>
              <span className={styles.dcUsed}>{d.usedCount}/{d.maxUses || '∞'} used</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VendorApplyForm() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', description: '', category: '', phone: '', address: '' });

  const applyMutation = useMutation({
    mutationFn: () => userApi.applyVendor(form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <h1 className={styles.title}>Become a Vendor</h1>
      </div>
      <div className={styles.content}>
        <p className={styles.applyDesc}>Register your shop on Hager Gebeya and start selling to local customers!</p>
        <div className={styles.form}>
          {[['name', 'Shop Name *'], ['description', 'Description'], ['category', 'Category (e.g. Groceries, Fashion)'], ['phone', 'Phone Number'], ['address', 'Address']].map(([key, label]) => (
            <input key={key} className={styles.input} placeholder={label}
              value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
          ))}
          <button className={styles.submitBtn} onClick={() => applyMutation.mutate()}
            disabled={!form.name || applyMutation.isPending}>
            {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
          </button>
          {applyMutation.isError && <p className={styles.error}>{applyMutation.error.message}</p>}
        </div>
      </div>
    </div>
  );
}
