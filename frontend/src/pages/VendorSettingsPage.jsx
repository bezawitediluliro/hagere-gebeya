import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Store, MapPin, Phone, FileText, Tag, Image, Check } from 'lucide-react';
import api, { userApi } from '../api/client';
import { useLanguage } from '../hooks/useLanguage';
import styles from './VendorSettingsPage.module.css';

const CATEGORIES = [
  { value: 'Groceries', en: '🥦 Groceries', am: '🥦 ምግብ ቁሳቁስ' },
  { value: 'Fashion', en: '👗 Fashion', am: '👗 ልብስ' },
  { value: 'Electronics', en: '📱 Electronics', am: '📱 ኤሌክትሮኒክስ' },
  { value: 'Food & Drinks', en: '🍽️ Food & Drinks', am: '🍽️ ምግብ እና መጠጥ' },
  { value: 'Beauty', en: '💄 Beauty', am: '💄 ውበት' },
  { value: 'Health', en: '💊 Health', am: '💊 ጤና' },
  { value: 'Home & Garden', en: '🏠 Home & Garden', am: '🏠 ቤት' },
  { value: 'Books', en: '📚 Books', am: '📚 መጻሕፍት' },
  { value: 'Sports', en: '⚽ Sports', am: '⚽ ስፖርት' },
  { value: 'Services', en: '🔧 Services', am: '🔧 አገልግሎቶች' },
  { value: 'Art & Crafts', en: '🎨 Art & Crafts', am: '🎨 ጥበብ' },
  { value: 'Other', en: '📦 Other', am: '📦 ሌሎች' },
];

export default function VendorSettingsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { lang } = useLanguage();
  const t = (en, am) => lang === 'am' ? am : en;

  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => userApi.me() });
  const vendor = me?.vendor;

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  if (vendor && !form) {
    setForm({
      name: vendor.name || '',
      description: vendor.description || '',
      category: vendor.category || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      logoUrl: vendor.logoUrl || '',
      bannerUrl: vendor.bannerUrl || '',
    });
  }

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/vendors/${vendor.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (isLoading || !form) return <div className={styles.loading}>{t('Loading...', 'እየተጫነ ነው...')}</div>;

  if (!vendor) {
    navigate('/vendor/onboarding', { replace: true });
    return null;
  }

  const selectedCat = CATEGORIES.find(c => c.value === form.category);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </button>
        <h1 className={styles.title}>{t('Shop Settings', 'የሱቅ ቅንጅቶች')}</h1>
        <button
          className={`${styles.saveBtn} ${saved ? styles.saved : ''}`}
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !form.name}
        >
          {saved ? <Check size={16} /> : null}
          {saveMutation.isPending ? t('Saving...', 'እየተቀመጠ...') : saved ? t('Saved!', 'ተቀምጧል!') : t('Save', 'ቀምጥ')}
        </button>
      </div>

      {/* Shop preview banner */}
      <div className={styles.bannerPreview} style={form.bannerUrl ? { backgroundImage: `url(${form.bannerUrl})` } : {}}>
        <div className={styles.bannerOverlay}>
          <div className={styles.shopAvatar}>
            {form.logoUrl
              ? <img src={form.logoUrl} alt={form.name} onError={e => e.target.style.display = 'none'} />
              : <span>{form.name ? form.name[0].toUpperCase() : '?'}</span>
            }
          </div>
          <div className={styles.shopMeta}>
            <div className={styles.shopName}>{form.name || t('Shop Name', 'የሱቅ ስም')}</div>
            <div className={styles.shopCat}>{selectedCat ? (lang === 'am' ? selectedCat.am : selectedCat.en) : form.category}</div>
          </div>
        </div>
      </div>

      <div className={styles.form}>
        {/* Identity */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Shop Identity', 'የሱቅ ማንነት')}</div>

          <div className={styles.field}>
            <label className={styles.label}><Store size={14} /> {t('Shop Name', 'የሱቅ ስም')} *</label>
            <input
              className={styles.input}
              placeholder={t('e.g. Abebe Fresh Market', 'ለምሳሌ: አበበ ትኩስ ምርቶች')}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              maxLength={50}
            />
            <span className={styles.charCount}>{form.name.length}/50</span>
          </div>

          <div className={styles.field}>
            <label className={styles.label}><Tag size={14} /> {t('Category', 'ምድብ')}</label>
            <button className={styles.catSelector} onClick={() => setShowCategoryPicker(true)}>
              <span>{selectedCat ? (lang === 'am' ? selectedCat.am : selectedCat.en) : t('Select category...', 'ምድብ ይምረጡ...')}</span>
              <ChevronLeft size={16} style={{ transform: 'rotate(180deg)' }} />
            </button>
          </div>

          <div className={styles.field}>
            <label className={styles.label}><FileText size={14} /> {t('Description', 'መግለጫ')}</label>
            <textarea
              className={styles.textarea}
              placeholder={t('What makes your shop special?', 'ሱቅዎ ምን ልዩ ያደርገዋል?')}
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              maxLength={300}
            />
            <span className={styles.charCount}>{form.description.length}/300</span>
          </div>
        </div>

        {/* Media */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Shop Images', 'የሱቅ ምስሎች')}</div>

          <div className={styles.field}>
            <label className={styles.label}><Image size={14} /> {t('Logo URL', 'የሎጎ URL')}</label>
            <input
              className={styles.input}
              placeholder="https://example.com/logo.jpg"
              value={form.logoUrl}
              onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
            />
            {form.logoUrl && (
              <img src={form.logoUrl} alt="logo" className={styles.imgPreview}
                onError={e => e.target.style.display = 'none'} />
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}><Image size={14} /> {t('Banner URL', 'የባነር URL')} <span className={styles.optional}>({t('optional', 'አማራጭ')})</span></label>
            <input
              className={styles.input}
              placeholder="https://example.com/banner.jpg"
              value={form.bannerUrl}
              onChange={e => setForm(f => ({ ...f, bannerUrl: e.target.value }))}
            />
            {form.bannerUrl && (
              <img src={form.bannerUrl} alt="banner" className={styles.bannerImgPreview}
                onError={e => e.target.style.display = 'none'} />
            )}
          </div>
        </div>

        {/* Contact */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Contact & Location', 'አድራሻ እና ስልክ')}</div>

          <div className={styles.field}>
            <label className={styles.label}><Phone size={14} /> {t('Phone Number', 'ስልክ ቁጥር')}</label>
            <input
              className={styles.input}
              placeholder="+251 9XX XXX XXX"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              type="tel"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}><MapPin size={14} /> {t('Address / Location', 'አድራሻ / ቦታ')}</label>
            <input
              className={styles.input}
              placeholder={t('e.g. Bole, Addis Ababa', 'ለምሳሌ: ቦሌ, አዲስ አበባ')}
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            />
          </div>
        </div>

        {/* Status */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('Shop Status', 'የሱቅ ሁኔታ')}</div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('Approval Status', 'የፍቃድ ሁኔታ')}</span>
            <span className={`${styles.statusBadge} ${vendor.approved ? styles.approved : styles.pending}`}>
              {vendor.approved ? t('✅ Approved', '✅ ጸድቋል') : t('⏳ Pending', '⏳ በመጠበቅ')}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('Rating', 'ደረጃ')}</span>
            <span className={styles.infoValue}>⭐ {vendor.rating?.toFixed(1) || '—'}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>{t('Total Revenue', 'ጠቅላላ ገቢ')}</span>
            <span className={styles.infoValue}>{(vendor.totalRevenue || 0).toFixed(2)} ETB</span>
          </div>
        </div>

        {saveMutation.isError && (
          <p className={styles.error}>{saveMutation.error.message}</p>
        )}
      </div>

      {/* Category picker modal */}
      {showCategoryPicker && (
        <div className={styles.modal} onClick={() => setShowCategoryPicker(false)}>
          <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>{t('Select Category', 'ምድብ ይምረጡ')}</div>
            <div className={styles.catGrid}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  className={`${styles.catOption} ${form.category === cat.value ? styles.catSelected : ''}`}
                  onClick={() => { setForm(f => ({ ...f, category: cat.value })); setShowCategoryPicker(false); }}
                >
                  {lang === 'am' ? cat.am : cat.en}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
