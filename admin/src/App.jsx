import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Store, Package, Users, Tag, Megaphone, Menu, X, LogOut
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Vendors from './pages/Vendors';
import Orders from './pages/Orders';
import UsersPage from './pages/UsersPage';
import Discounts from './pages/Discounts';
import Broadcast from './pages/Broadcast';
import styles from './App.module.css';

const tg = window.Telegram?.WebApp;

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/vendors', icon: Store, label: 'Vendors' },
  { to: '/orders', icon: Package, label: 'Orders' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/discounts', icon: Tag, label: 'Discounts' },
  { to: '/broadcast', icon: Megaphone, label: 'Broadcast' },
];

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    tg?.ready();
    tg?.expand();
  }, []);

  return (
    <div className={styles.root}>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <span className={styles.logoEmoji}>🛍️</span>
            <span className={styles.logoText}>Hager Gebeya</span>
          </div>
          <button className={styles.sidebarClose} onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className={styles.nav}>
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navActive : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <span className={styles.adminLabel}>Admin Panel</span>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <span className={styles.pageTitle}>Admin</span>
        </header>

        <div className={styles.content}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vendors" element={<Vendors />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/discounts" element={<Discounts />} />
            <Route path="/broadcast" element={<Broadcast />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
