import { createContext, useContext, useState, useEffect } from 'react';

const translations = {
  en: {
    shop: 'Shop', cart: 'Cart', orders: 'Orders', profile: 'Profile',
    search: 'Search vendors...', allVendors: 'All Vendors',
    addToCart: 'Add to Cart', outOfStock: 'Out of Stock',
    checkout: 'Checkout', placeOrder: 'Place Order',
    discountCode: 'Discount Code', apply: 'Apply',
    deliveryAddress: 'Delivery Address', notes: 'Notes (optional)',
    paymentMethod: 'Payment Method', cash: 'Cash on Delivery',
    telebirr: 'TeleBirr (Coming Soon)', orderPlaced: 'Order Placed!',
    trackOrders: 'Track Orders', myOrders: 'My Orders',
    noOrders: 'No orders yet', startShopping: 'Start Shopping',
    orderSummary: 'Order Summary', subtotal: 'Subtotal',
    discount: 'Discount', total: 'Total', items: 'items',
    vendorDashboard: 'Vendor Dashboard', becomeVendor: 'Become a Vendor',
    manageProducts: 'Products', manageOrders: 'Orders', manageDiscounts: 'Discounts',
    addProduct: 'Add Product', createCode: 'Create Code',
    productName: 'Product Name', price: 'Price (ETB)', category: 'Category',
    stock: 'Stock', description: 'Description', inStock: 'in stock',
    reviews: 'Reviews', rating: 'Rating', writeReview: 'Write a Review',
    loyaltyPoints: 'Loyalty Points', points: 'points', redeem: 'Redeem Points',
    referral: 'Invite Friends', shareReferral: 'Share your referral link',
    notifications: 'Notifications', noNotifications: 'All caught up!',
    featuredVendors: 'Featured Vendors', trending: 'Trending',
    newArrivals: 'New Arrivals', categories: 'Categories',
    promotions: 'Promotions', boostShop: 'Boost Your Shop',
    adDuration: 'Duration (days)', createAd: 'Create Promotion',
    language: 'Language', english: 'English', amharic: 'አማርኛ',
    sharePhone: 'Share Phone Number', phoneRequired: 'Phone required for vendors',
    applicationPending: 'Application Pending',
    confirm: 'Confirm', cancel: 'Cancel', save: 'Save', close: 'Close',
    etb: 'ETB', sold: 'sold', followers: 'followers',
    viewAll: 'View All', seeMore: 'See More',
    address: 'Address', phone: 'Phone', website: 'Website',
    vendorInfo: 'Vendor Info', openingHours: 'Opening Hours',
    weeklyReport: 'Weekly Report', revenue: 'Revenue',
    topProducts: 'Top Products', newCustomers: 'New Customers',
    adFeatures: 'Promotion Features', impressions: 'Impressions', clicks: 'Clicks',
  },
  am: {
    shop: 'ሱቅ', cart: 'ጋሪ', orders: 'ትዕዛዞች', profile: 'መገለጫ',
    search: 'ሻጮችን ይፈልጉ...', allVendors: 'ሁሉም ሻጮች',
    addToCart: 'ወደ ጋሪ ጨምር', outOfStock: 'አልቋል',
    checkout: 'ክፈያ', placeOrder: 'ትዕዛዝ ስጥ',
    discountCode: 'የቅናሽ ኮድ', apply: 'አስተግብር',
    deliveryAddress: 'የመላኪያ አድራሻ', notes: 'ማስታወሻ (አማራጭ)',
    paymentMethod: 'የክፍያ ዘዴ', cash: 'ጥሬ ገንዘብ',
    telebirr: 'ቴሌብር (በቅርቡ)', orderPlaced: 'ትዕዛዝ ተቀምጧል!',
    trackOrders: 'ትዕዛዞቾን ይከታተሉ', myOrders: 'ትዕዛዞቼ',
    noOrders: 'እስካሁን ምንም ትዕዛዝ የለም', startShopping: 'ግዢ ጀምሩ',
    orderSummary: 'የትዕዛዝ ማጠቃለያ', subtotal: 'ንዑስ ድምር',
    discount: 'ቅናሽ', total: 'ጠቅላላ', items: 'ዕቃዎች',
    vendorDashboard: 'የሻጭ ዳሽቦርድ', becomeVendor: 'ሻጭ ይሁኑ',
    manageProducts: 'ምርቶች', manageOrders: 'ትዕዛዞች', manageDiscounts: 'ቅናሾች',
    addProduct: 'ምርት ጨምር', createCode: 'ኮድ ፍጠር',
    productName: 'የምርት ስም', price: 'ዋጋ (ብር)', category: 'ምድብ',
    stock: 'ክምችት', description: 'መግለጫ', inStock: 'አለ',
    reviews: 'ግምገማዎች', rating: 'ደረጃ', writeReview: 'ግምገማ ጻፍ',
    loyaltyPoints: 'የቅናሽ ነጥቦች', points: 'ነጥቦች', redeem: 'ነጥቦቾን አስወጣ',
    referral: 'ጓደኞቾን ጋብዙ', shareReferral: 'የሪፈራል ሊንክዎን ያጋሩ',
    notifications: 'ማሳወቂያዎች', noNotifications: 'ሁሉም ተነብቧል!',
    featuredVendors: 'ተለይተው የቀረቡ ሻጮች', trending: 'ታዋቂ',
    newArrivals: 'አዲስ ምርቶች', categories: 'ምድቦች',
    promotions: 'ማስተዋወቂያዎች', boostShop: 'ሱቅዎን ያስተዋውቁ',
    adDuration: 'ጊዜ (ቀናት)', createAd: 'ማስተዋወቂያ ፍጠር',
    language: 'ቋንቋ', english: 'English', amharic: 'አማርኛ',
    sharePhone: 'ስልክ ቁጥር ያጋሩ', phoneRequired: 'ለሻጮች ስልክ ያስፈልጋል',
    applicationPending: 'ፍቃድ እየጠበቀ ነው',
    confirm: 'አረጋግጥ', cancel: 'ሰርዝ', save: 'አስቀምጥ', close: 'ዝጋ',
    etb: 'ብር', sold: 'ተሸጧል', followers: 'ተከታዮች',
    viewAll: 'ሁሉንም ይመልከቱ', seeMore: 'ተጨማሪ ይመልከቱ',
    address: 'አድራሻ', phone: 'ስልክ', website: 'ድረ-ገጽ',
    vendorInfo: 'የሻጭ መረጃ', openingHours: 'የሥራ ሰዓቶች',
    weeklyReport: 'ሳምንታዊ ሪፖርት', revenue: 'ገቢ',
    topProducts: 'ምርጥ ምርቶች', newCustomers: 'አዲስ ደንበኞች',
    adFeatures: 'ማስተዋወቂያ ባህሪያት', impressions: 'ታይቶታል', clicks: 'ተጫኗል',
  },
};

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('hg_lang') || 'en');

  function setLang(l) {
    setLangState(l);
    localStorage.setItem('hg_lang', l);
  }

  function t(key) {
    return translations[lang]?.[key] || translations.en[key] || key;
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
