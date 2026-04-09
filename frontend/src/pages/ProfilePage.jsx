import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Store, Package, User, ChevronRight } from 'lucide-react';
import { userApi } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user: tgUser } = useTelegram();
  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => userApi.me() });

  if (isLoading) return <div className={styles.loading}>Loading...</div>;

  const vendor = me?.vendor;

  return (
    <div className={styles.page}>
      {/* Profile header */}
      <div className={styles.header}>
        <div className={styles.avatar}>
          {tgUser?.photo_url
            ? <img src={tgUser.photo_url} alt="avatar" />
            : <User size={32} />
          }
        </div>
        <div>
          <div className={styles.name}>
            {me?.firstName || tgUser?.first_name || 'Guest'}
            {me?.role === 'ADMIN' && <span className={styles.adminBadge}>Admin</span>}
            {me?.role === 'VENDOR' && <span className={styles.vendorBadge}>Vendor</span>}
          </div>
          {me?.username && <div className={styles.username}>@{me.username}</div>}
        </div>
      </div>

      {/* Quick actions */}
      <div className={styles.section}>
        <button className={styles.menuItem} onClick={() => navigate('/orders')}>
          <Package size={18} className={styles.menuIcon} />
          <span>My Orders</span>
          <ChevronRight size={16} className={styles.arrow} />
        </button>

        {vendor?.approved ? (
          <button className={styles.menuItem} onClick={() => navigate('/vendor')}>
            <Store size={18} className={styles.menuIcon} />
            <span>Vendor Dashboard — {vendor.name}</span>
            <ChevronRight size={16} className={styles.arrow} />
          </button>
        ) : vendor && !vendor.approved ? (
          <div className={styles.menuItem}>
            <Store size={18} className={styles.menuIcon} />
            <span>Vendor Application Pending...</span>
          </div>
        ) : (
          <button className={styles.menuItem} onClick={() => navigate('/vendor')}>
            <Store size={18} className={styles.menuIcon} />
            <span>Become a Vendor</span>
            <ChevronRight size={16} className={styles.arrow} />
          </button>
        )}
      </div>

      {me?.role === 'ADMIN' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Admin</div>
          <button className={styles.menuItem} onClick={() => window.open('/admin', '_blank')}>
            <span>Open Admin Panel</span>
            <ChevronRight size={16} className={styles.arrow} />
          </button>
        </div>
      )}

      <div className={styles.footer}>
        <p>Hager Gebeya</p>
        <p className={styles.footerSub}>Your local marketplace</p>
      </div>
    </div>
  );
}
