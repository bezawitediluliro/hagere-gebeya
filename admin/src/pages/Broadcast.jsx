import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Megaphone, CheckCircle } from 'lucide-react';
import { adminApi } from '../api/client';
import styles from './Broadcast.module.css';

export default function Broadcast() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState(null);

  const broadcastMutation = useMutation({
    mutationFn: () => adminApi.broadcast(message),
    onSuccess: (data) => {
      setResult(data);
      setMessage('');
    },
  });

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>📢 Broadcast Message</h1>
      <p className={styles.desc}>Send a message to all registered users on Telegram.</p>

      <div className={styles.card}>
        <label className={styles.label}>Message</label>
        <textarea
          className={styles.textarea}
          placeholder="Type your message... (Markdown supported: *bold*, _italic_)"
          rows={6}
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <div className={styles.tips}>
          Tip: Use *bold*, _italic_, `code` for formatting. Keep messages short and relevant.
        </div>
        <button
          className={styles.sendBtn}
          onClick={() => broadcastMutation.mutate()}
          disabled={!message.trim() || broadcastMutation.isPending}
        >
          <Megaphone size={18} />
          {broadcastMutation.isPending ? 'Sending...' : 'Send to All Users'}
        </button>
        {broadcastMutation.isError && (
          <p className={styles.error}>{broadcastMutation.error.message}</p>
        )}
      </div>

      {result && (
        <div className={styles.resultCard}>
          <CheckCircle size={24} className={styles.resultIcon} />
          <div>
            <div className={styles.resultTitle}>Broadcast Sent!</div>
            <div className={styles.resultSub}>
              ✅ {result.sent} sent · ❌ {result.failed} failed · 👥 {result.total} total
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
