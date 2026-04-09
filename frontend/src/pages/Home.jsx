import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Store, Tag, ChevronRight } from 'lucide-react';
import { vendorsApi } from '../api/client';
import { useTelegram } from '../hooks/useTelegram';
import styles from './Home.module.css';

export default function Home() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const navigate = useNavigate();
  const { user } = useTelegram();

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['vendors', search, category],
    queryFn: () => vendorsApi.list({ search: search || undefined, category: category || undefined }),
  });

  const { data: categories } = useQuery({
    queryKey: ['vendorCategories'],
    queryFn: () => vendorsApi.categories(),
  });

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>🛍️ Hager Gebeya</h1>
          {user && <p className={styles.subtitle}>Hello, {user.first_name}!</p>}
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <Search size={16} className={styles.searchIcon} />
        <input
          className={styles.searchInput}
          placeholder="Search vendors..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Categories */}
      {categories?.length > 0 && (
        <div className={styles.categories}>
          <button
            className={`${styles.cat} ${!category ? styles.catActive : ''}`}
            onClick={() => setCategory('')}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`${styles.cat} ${category === cat ? styles.catActive : ''}`}
              onClick={() => setCategory(category === cat ? '' : cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Vendors */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <Store size={16} /> Local Shops
        </h2>

        {isLoading && (
          <div className={styles.loading}>
            {[1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
          </div>
        )}

        {!isLoading && vendors?.length === 0 && (
          <div className={styles.empty}>
            <Store size={40} />
            <p>No vendors found</p>
          </div>
        )}

        <div className={styles.vendorList}>
          {vendors?.map(vendor => (
            <button
              key={vendor.id}
              className={styles.vendorCard}
              onClick={() => navigate(`/vendor/${vendor.id}`)}
            >
              <div className={styles.vendorAvatar}>
                {vendor.logoUrl
                  ? <img src={vendor.logoUrl} alt={vendor.name} />
                  : <span>{vendor.name[0]}</span>
                }
              </div>
              <div className={styles.vendorInfo}>
                <div className={styles.vendorName}>{vendor.name}</div>
                {vendor.category && (
                  <div className={styles.vendorMeta}>
                    <Tag size={12} /> {vendor.category}
                  </div>
                )}
                {vendor.description && (
                  <div className={styles.vendorDesc}>{vendor.description}</div>
                )}
                <div className={styles.vendorCount}>
                  {vendor.productCount} products
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
