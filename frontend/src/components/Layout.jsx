import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, User, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cartApi } from '../api/client';
import { useLanguage } from '../hooks/useLanguage';
import styles from './Layout.module.css';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const { data: cartItems } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get(),
    staleTime: 10000,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => import('../api/client').then(m => m.default.get('/notifications')),
    staleTime: 30000,
  });

  const cartCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const unreadNotifs = notifData?.unread || 0;

  const navItems = [
    { path: '/', icon: Home, label: t('shop'), end: true },
    { path: '/cart', icon: ShoppingCart, label: t('cart'), badge: cartCount },
    { path: '/orders', icon: Package, label: t('orders') },
    { path: '/notifications', icon: Bell, label: t('notifications'), badge: unreadNotifs },
    { path: '/profile', icon: User, label: t('profile') },
  ];

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <Outlet />
      </main>
      <nav className={styles.nav}>
        {navItems.map(({ path, icon: Icon, label, badge, end }) => {
          const active = end ? location.pathname === path : location.pathname.startsWith(path);
          return (
            <button key={path} className={`${styles.navItem} ${active ? styles.active : ''}`} onClick={() => navigate(path)}>
              <span className={styles.iconWrap}>
                <Icon size={22} />
                {badge > 0 && <span className={styles.badge}>{badge > 99 ? '99+' : badge}</span>}
              </span>
              <span className={styles.navLabel}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
