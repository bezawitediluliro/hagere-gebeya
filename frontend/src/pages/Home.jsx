import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Store, Tag, ChevronRight, Star, Zap, TrendingUp } from 'lucide-react';
import { vendorsApi } from '../api/client';
import api from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import { useLanguage } from '../hooks/useLanguage';
import styles from './Home.module.css';

export default function Home() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const navigate = useNavigate();
  const { user } = useTelegram();
  const { t, lang } = useLanguage();

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors', search, category],
    queryFn: () => vendorsApi.list({ search: search || undefined, category: category || undefined }),
  });

  const { data: categories } = useQuery({
    queryKey: ['vendorCategories'],
    queryFn: () => vendorsApi.categories(),
  });

  const { data: ads } = useQuery({
    queryKey: ['ads'],
    queryFn: () => api.get('/ads/active'),
    staleTime: 60000,
  });

  const featuredVendors = vendors?.filter(v => v.featured) || [];
  const regularVendors = vendors?.filter(v => !v.featured) || [];
  const bannerAds = ads?.filter(a => a.type === 'banner') || [];

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🛍️ {lang === 'am' ? 'ሃገር ገበያ' : 'Hager Gebeya'}</h1>
          {user && <p className={styles.subtitle}>{lang === 'am' ? `ሰላም, ${user.first_name}!` : `Hello, ${user.first_name}!`}</p>}
        </div>
        <button className={styles.langBtn} onClick={() => navigate('/profile')}>
          {lang === 'am' ? '🇪🇹' : '🇬🇧'}
        </button>
      </div>

      {/* Banner Ads */}
      {bannerAds.length > 0 && (
        <div className={styles.bannerAds}>
          {bannerAds.map(ad => (
            <div key={ad.id} className={styles.bannerAd} onClick={() => {
              api.post(`/ads/${ad.id}/click`).catch(() => {});
              if (ad.vendor) navigate(`/vendor/${ad.vendor.id}`);
            }}>
              {ad.imageUrl
                ? <img src={ad.imageUrl} alt={ad.title} className={styles.bannerImg} />
                : <div className={styles.bannerPlaceholder}><Zap size={20} /> <span>{ad.title}</span></div>
              }
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className={styles.searchWrap}>
        <Search size={16} className={styles.searchIcon} />
        <input className={styles.searchInput} placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Categories */}
      {categories?.length > 0 && (
        <div className={styles.categories}>
          <button className={`${styles.cat} ${!category ? styles.catActive : ''}`} onClick={() => setCategory('')}>
            {t('allVendors')}
          </button>
          {categories.map(cat => (
            <button key={cat} className={`${styles.cat} ${category === cat ? styles.catActive : ''}`} onClick={() => setCategory(category === cat ? '' : cat)}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Featured vendors */}
      {featuredVendors.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}><Zap size={14} /> {t('featuredVendors')}</h2>
          <div className={styles.featuredRow}>
            {featuredVendors.map(vendor => (
              <button key={vendor.id} className={styles.featuredCard} onClick={() => navigate(`/vendor/${vendor.id}`)}>
                <div className={styles.featuredAvatar}>
                  {vendor.logoUrl ? <img src={vendor.logoUrl} alt={vendor.name} /> : <span>{vendor.name[0]}</span>}
                </div>
                <div className={styles.featuredName}>{vendor.name}</div>
                {vendor.rating > 0 && (
                  <div className={styles.featuredRating}><Star size={10} fill="currentColor" /> {vendor.rating.toFixed(1)}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All vendors */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}><Store size={14} /> {t('allVendors')}</h2>

        {isLoading && <div className={styles.loading}>{[1,2,3].map(i => <div key={i} className={styles.skeleton} />)}</div>}

        {!isLoading && vendors?.length === 0 && (
          <div className={styles.empty}><Store size={40} /><p>{lang === 'am' ? 'ምንም ሻጭ አልተገኘም' : 'No vendors found'}</p></div>
        )}

        <div className={styles.vendorList}>
          {regularVendors.map(vendor => (
            <button key={vendor.id} className={styles.vendorCard} onClick={() => navigate(`/vendor/${vendor.id}`)}>
              <div className={styles.vendorAvatar}>
                {vendor.logoUrl ? <img src={vendor.logoUrl} alt={vendor.name} /> : <span>{vendor.name[0]}</span>}
              </div>
              <div className={styles.vendorInfo}>
                <div className={styles.vendorName}>{vendor.name}</div>
                {vendor.category && <div className={styles.vendorMeta}><Tag size={12} /> {vendor.category}</div>}
                {vendor.description && <div className={styles.vendorDesc}>{vendor.description}</div>}
                <div className={styles.vendorFooter}>
                  <span className={styles.vendorCount}>{vendor.productCount} {lang === 'am' ? 'ምርቶች' : 'products'}</span>
                  {vendor.rating > 0 && (
                    <span className={styles.vendorRating}><Star size={11} fill="currentColor" /> {vendor.rating.toFixed(1)} ({vendor.reviewCount})</span>
                  )}
                </div>
              </div>
              <ChevronRight size={18} className={styles.arrow} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
