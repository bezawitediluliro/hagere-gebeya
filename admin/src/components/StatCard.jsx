import styles from './StatCard.module.css';

export default function StatCard({ icon, label, value, sub, color = 'blue' }) {
  return (
    <div className={`${styles.card} ${styles[color]}`}>
      <div className={styles.icon}>{icon}</div>
      <div className={styles.body}>
        <div className={styles.value}>{value ?? '—'}</div>
        <div className={styles.label}>{label}</div>
        {sub && <div className={styles.sub}>{sub}</div>}
      </div>
    </div>
  );
}
