import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, Package, Tag, Star, Gift } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../hooks/useLanguage';
import styles from './NotificationsPage.module.css';

const TYPE_ICON = {
  order: Package, discount: Tag, review: Star, referral: Gift, system: Bell,
};
const TYPE_COLOR = {
  order: '#3b82f6', discount: '#f59e0b', review: '#8b5cf6', referral: '#16a34a', system: '#64748b',
};

export default function NotificationsPage() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications'),
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('notifications')}</h1>
        {data?.unread > 0 && (
          <button className={styles.readAllBtn} onClick={() => readAllMutation.mutate()}>
            <CheckCheck size={16} /> {lang === 'am' ? 'ሁሉንም አንብብ' : 'Mark all read'}
          </button>
        )}
      </div>

      {isLoading && <div className={styles.loading}>Loading...</div>}

      {!isLoading && !data?.notifications?.length && (
        <div className={styles.empty}>
          <Bell size={48} />
          <p>{t('noNotifications')}</p>
        </div>
      )}

      <div className={styles.list}>
        {data?.notifications?.map(n => {
          const Icon = TYPE_ICON[n.type] || Bell;
          const color = TYPE_COLOR[n.type] || '#64748b';
          return (
            <div
              key={n.id}
              className={`${styles.notif} ${!n.read ? styles.unread : ''}`}
              onClick={() => { readMutation.mutate(n.id); if (n.data) { try { const d = JSON.parse(n.data); if (d.orderId) navigate(`/orders/${d.orderId}`); } catch {} } }}
            >
              <div className={styles.icon} style={{ background: color + '20', color }}>
                <Icon size={18} />
              </div>
              <div className={styles.body}>
                <div className={styles.notifTitle}>{lang === 'am' && n.titleAm ? n.titleAm : n.titleEn}</div>
                <div className={styles.notifBody}>{lang === 'am' && n.bodyAm ? n.bodyAm : n.bodyEn}</div>
                <div className={styles.notifTime}>{new Date(n.createdAt).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              {!n.read && <div className={styles.dot} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
