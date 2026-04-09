import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Phone, Globe, Check } from 'lucide-react';
import api, { userApi } from '../api/client';
import { useLanguage } from '../hooks/useLanguage';
import styles from './ProfileEditPage.module.css';

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { lang, setLang } = useLanguage();
  const t = (en, am) => lang === 'am' ? am : en;

  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => userApi.me() });

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  // Initialize form from me when loaded
  if (me && !form) {
    setForm({ firstName: me.firstName || '', phone: me.phone || '' });
  }

  const saveMutation = useMutation({
    mutationFn: () => api.patch('/user/me', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const langMutation = useMutation({
    mutationFn: (language) => api.patch('/user/me', { language }),
    onSuccess: (_, language) => {
      setLang(language);
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  if (isLoading || !form) return <div className={styles.loading}>{t('Loading...', 'እየተጫነ ነው...')}</div>;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </button>
        <h1 className={styles.title}>{t('Edit Profile', 'መገለጫ አርትዕ')}</h1>
        <button
          className={`${styles.saveBtn} ${saved ? styles.saved : ''}`}
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saved ? <Check size={16} /> : null}
          {saveMutation.isPending ? t('Saving...', 'እየተቀመጠ...') : saved ? t('Saved!', 'ተቀምጧል!') : t('Save', 'ቀምጥ')}
        </button>
      </div>

      {/* Avatar section */}
      <div className={styles.avatarSection}>
        <div className={styles.avatar}>
          <User size={36} />
        </div>
        <p className={styles.avatarHint}>{t('Profile photo from Telegram', 'የፕሮፋይል ፎቶ ከቴሌግራም')}</p>
      </div>

      {/* Form */}
      <div className={styles.form}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Personal Info', 'የግል መረጃ')}</div>

          <div className={styles.field}>
            <label className={styles.label}>
              <User size={14} /> {t('Display Name', 'ስም')}
            </label>
            <input
              className={styles.input}
              placeholder={t('Your name', 'ስምዎ')}
              value={form.firstName}
              onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
              maxLength={40}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              <Phone size={14} /> {t('Phone Number', 'ስልክ ቁጥር')}
            </label>
            <input
              className={styles.input}
              placeholder="+251 9XX XXX XXX"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              type="tel"
            />
            <span className={styles.fieldHint}>{t('Used by vendors to contact you', 'ሻጮች ለመደወል ይጠቀሙበታል')}</span>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Language / ቋንቋ', 'ቋንቋ / Language')}</div>
          <div className={styles.langGrid}>
            <button
              className={`${styles.langOption} ${lang === 'en' ? styles.langActive : ''}`}
              onClick={() => langMutation.mutate('en')}
            >
              <span className={styles.langFlag}>🇬🇧</span>
              <span className={styles.langName}>English</span>
              {lang === 'en' && <Check size={16} className={styles.langCheck} />}
            </button>
            <button
              className={`${styles.langOption} ${lang === 'am' ? styles.langActive : ''}`}
              onClick={() => langMutation.mutate('am')}
            >
              <span className={styles.langFlag}>🇪🇹</span>
              <span className={styles.langName}>አማርኛ</span>
              {lang === 'am' && <Check size={16} className={styles.langCheck} />}
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Account', 'መለያ')}</div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Telegram ID</span>
            <span className={styles.infoValue}>{me.telegramId}</span>
          </div>
          {me.username && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>{t('Username', 'የተጠቃሚ ስም')}</span>
              <span className={styles.infoValue}>@{me.username}</span>
            </div>
          )}
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('Role', 'ሚና')}</span>
            <span className={`${styles.infoValue} ${styles.roleBadge} ${styles[`role_${me.role}`]}`}>{me.role}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('Points', 'ነጥቦች')}</span>
            <span className={styles.infoValue}>⭐ {me.points || 0}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('Referral Code', 'ሪፈራል ኮድ')}</span>
            <span className={styles.infoValue} style={{ fontFamily: 'monospace' }}>{me.referralCode}</span>
          </div>
        </div>

        {saveMutation.isError && (
          <p className={styles.error}>{saveMutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
