import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { cartApi } from '../api/client';
import styles from './Layout.module.css';

const navItems = [
  { path: '/', icon: Home, label: 'Shop' },
  { path: '/cart', icon: ShoppingCart, label: 'Cart' },
  { path: '/orders', icon: Package, label: 'Orders' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const { data: cartItems } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get(),
    staleTime: 10000,
  });

  const cartCount = cartItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;

  return (
    <div className={styles.root}>
      <main className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.nav}>
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);

          return (
            <button
              key={path}
              className={`${styles.navItem} ${active ? styles.active : ''}`}
              onClick={() => navigate(path)}
            >
              <span className={styles.iconWrap}>
                <Icon size={22} />
                {path === '/cart' && cartCount > 0 && (
                  <span className={styles.badge}>{cartCount > 99 ? '99+' : cartCount}</span>
                )}
              </span>
              <span className={styles.navLabel}>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
