import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/client';
import styles from './TablePage.module.css';

const ROLE_COLOR = { CUSTOMER: 'gray', VENDOR: 'green', ADMIN: 'purple' };

export default function UsersPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: () => adminApi.users(),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => adminApi.updateUserRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['adminUsers'] }),
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Users</h1>
      </div>

      {isLoading ? <div className={styles.loading}>Loading...</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Telegram ID</th>
                <th>Vendor</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Change Role</th>
              </tr>
            </thead>
            <tbody>
              {data?.users?.length === 0 && (
                <tr><td colSpan={6} className={styles.empty}>No users found.</td></tr>
              )}
              {data?.users?.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className={styles.nameCell}>
                      <div className={styles.userAvatar}>{(u.firstName || u.username || '?')[0]}</div>
                      <div>
                        <div className={styles.name}>{u.firstName} {u.lastName}</div>
                        {u.username && <div className={styles.sub}>@{u.username}</div>}
                      </div>
                    </div>
                  </td>
                  <td><code className={styles.mono}>{u.telegramId}</code></td>
                  <td className={styles.sub}>{u.vendor?.name || '—'}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[`badge_${ROLE_COLOR[u.role]}`]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className={styles.sub}>
                    {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </td>
                  <td>
                    <select
                      className={styles.select}
                      value={u.role}
                      onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}
                    >
                      <option value="CUSTOMER">CUSTOMER</option>
                      <option value="VENDOR">VENDOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data?.total > 0 && <div className={styles.count}>{data.total} user{data.total !== 1 ? 's' : ''}</div>}
        </div>
      )}
    </div>
  );
}
