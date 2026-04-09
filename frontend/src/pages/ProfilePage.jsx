import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Store, Package, User, Star, Gift, Share2, Globe, ChevronRight, Phone } from 'lucide-react';
import { userApi } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useLanguage } from '../hooks/useLanguage';
import api from '../api/client';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user: tgUser } = useTelegram();
  const { t, lang, setLang } = useLanguage();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);

  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => userApi.me() });

  const langMutation = useMutation({
    mutationFn: (language) => api.patch('/user/me', { language }),
    onSuccess: (_, language) => { setLang(language); qc.invalidateQueries({ queryKey: ['me'] }); },
  });

  if (isLoading) return <div className={styles.loading}>Loading...</div>;

  const vendor = me?.vendor;
  const pointsValue = ((me?.points || 0) * 0.1).toFixed(2);
  const botUsername = 'HagerGebeyaBot'; // replace with your bot username
  const referralLink = `https://t.me/${botUsername}?start=ref_${me?.referralCode || 'CODE'}`;

  function copyReferral() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.avatar}>
          {tgUser?.photo_url ? <img src={tgUser.photo_url} alt="avatar" /> : <User size={32} />}
        </div>
        <div className={styles.userInfo}>
          <div className={styles.name}>
            {me?.firstName || tgUser?.first_name || 'Guest'}
            {me?.role === 'ADMIN' && <span className={styles.adminBadge}>Admin</span>}
            {me?.role === 'VENDOR' && <span className={styles.vendorBadge}>{t('manageOrders').includes('ት') ? 'ሻጭ' : 'Vendor'}</span>}
          </div>
          {me?.username && <div className={styles.username}>@{me.username}</div>}
          {me?.phone && <div className={styles.phone}>{me.phone}</div>}
        </div>
      </div>

      {/* Loyalty points card */}
      <div className={styles.pointsCard}>
        <div className={styles.pointsLeft}>
          <Star size={20} fill="#f59e0b" color="#f59e0b" />
          <div>
            <div className={styles.pointsLabel}>{t('loyaltyPoints')}</div>
            <div className={styles.pointsValue}>{me?.points || 0} {t('points')}</div>
          </div>
        </div>
        <div className={styles.pointsRight}>
          <div className={styles.pointsEtb}>{pointsValue} {t('etb')}</div>
          <div className={styles.pointsHint}>{lang === 'am' ? '100 ነጥብ = 10 ብር' : '100pts = 10 ETB'}</div>
        </div>
      </div>

      {/* Language toggle */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('language')}</div>
        <div className={styles.langToggle}>
          <button
            className={`${styles.langBtn} ${lang === 'en' ? styles.langActive : ''}`}
            onClick={() => langMutation.mutate('en')}
          >
            🇬🇧 {t('english')}
          </button>
          <button
            className={`${styles.langBtn} ${lang === 'am' ? styles.langActive : ''}`}
            onClick={() => langMutation.mutate('am')}
          >
            🇪🇹 {t('amharic')}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className={styles.section}>
        <button className={styles.menuItem} onClick={() => navigate('/orders')}>
          <Package size={18} className={styles.menuIcon} />
          <span>{t('myOrders')}</span>
          <ChevronRight size={16} className={styles.arrow} />
        </button>

        {vendor?.approved ? (
          <button className={styles.menuItem} onClick={() => navigate('/vendor')}>
            <Store size={18} className={styles.menuIcon} />
            <span>{t('vendorDashboard')} — {vendor.name}</span>
            <ChevronRight size={16} className={styles.arrow} />
          </button>
        ) : vendor && !vendor.approved ? (
          <div className={styles.menuItem}>
            <Store size={18} className={styles.menuIcon} />
            <span>{t('applicationPending')} ({vendor.name})</span>
          </div>
        ) : (
          <button className={styles.menuItem} onClick={() => navigate('/vendor')}>
            <Store size={18} className={styles.menuIcon} />
            <span>{t('becomeVendor')}</span>
            <ChevronRight size={16} className={styles.arrow} />
          </button>
        )}

        {!me?.phone && (
          <button className={styles.menuItem} onClick={() => setShowPhonePrompt(true)}>
            <Phone size={18} className={styles.menuIcon} />
            <span>{t('sharePhone')}</span>
            <ChevronRight size={16} className={styles.arrow} />
          </button>
        )}
      </div>

      {/* Referral */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('referral')}</div>
        <div className={styles.referralCard}>
          <div className={styles.referralText}>
            <Gift size={16} />
            <span>{lang === 'am' ? 'ጓደኞቾን ሲቀላቀሉ 50 ነጥቦች ያሸናሉ!' : 'Earn 50 points for each friend who joins!'}</span>
          </div>
          <button className={styles.copyBtn} onClick={copyReferral}>
            <Share2 size={14} />
            {copied ? (lang === 'am' ? '✅ ተቀድቷል!' : '✅ Copied!') : (lang === 'am' ? 'ሊንክ ቅዳ' : 'Copy Link')}
          </button>
        </div>
      </div>

      {me?.role === 'ADMIN' && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Admin</div>
          <button className={styles.menuItem} onClick={() => navigate('/admin-panel')}>
            <span>{lang === 'am' ? 'ዋና ዳሽቦርድ' : 'Admin Panel'}</span>
            <ChevronRight size={16} className={styles.arrow} />
          </button>
        </div>
      )}

      {showPhonePrompt && (
        <PhonePrompt onClose={() => setShowPhonePrompt(false)} t={t} lang={lang} qc={qc} />
      )}

      <div className={styles.footer}>
        <p>Hager Gebeya / ሃገር ገበያ</p>
        <p className={styles.footerSub}>{lang === 'am' ? 'የአካባቢ ገበያ' : 'Your local marketplace'}</p>
      </div>
    </div>
  );
}

function PhonePrompt({ onClose, t, lang, qc }) {
  const [phone, setPhone] = useState('');
  const mutation = useMutation({
    mutationFn: () => api.patch('/user/me', { phone }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); onClose(); },
  });

  return (
    <div className={styles.modal}>
      <div className={styles.modalBox}>
        <div className={styles.modalTitle}>{t('sharePhone')}</div>
        <input
          className={styles.phoneInput}
          placeholder="+251 9XX XXX XXX"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          type="tel"
        />
        <div className={styles.modalBtns}>
          <button className={styles.saveBtn} onClick={() => mutation.mutate()} disabled={!phone || mutation.isPending}>
            {mutation.isPending ? '...' : t('save')}
          </button>
          <button className={styles.cancelBtn2} onClick={onClose}>{t('cancel')}</button>
        </div>
      </div>
    </div>
  );
}
