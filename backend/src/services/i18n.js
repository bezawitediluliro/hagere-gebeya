const translations = {
  en: {
    welcome: (name) => `👋 Welcome to *Hager Gebeya*, ${name}!\n\n🛒 Shop from local vendors\n🏷️ Get exclusive discounts\n📦 Track your orders\n⭐ Earn loyalty points`,
    welcome_back: (name) => `👋 Welcome back, ${name}!`,
    open_shop: '🛍️ Open Shop',
    my_orders: '📦 My Orders',
    help: 'ℹ️ Help',
    language_set: '✅ Language set to English.',
    choose_language: '🌐 Choose your language / ቋንቋ ይምረጡ:',
    vendors_title: '🏪 *Active Vendors:*',
    no_vendors: 'No vendors found. Check back soon!',
    become_vendor: '🏪 *Become a Vendor on Hager Gebeya*\n\nSend your shop details or use the onboarding button below:',
    vendor_pending: (name) => `⏳ Your shop *${name}* is pending approval.`,
    vendor_approved_notif: (name) => `🎉 *Congratulations!*\n\nYour shop *${name}* has been approved!\n\nYou can now add products and start selling. Use /vendor_dashboard to manage your shop.`,
    vendor_rejected: (name) => `Sorry, *${name}* was not approved at this time. Contact support for more info.`,
    new_order_notif: (orderNum, total) => `🆕 *New Order!* \`${orderNum}\`\n💰 Total: *${total} ETB*`,
    order_status_confirmed: '✅ Your order has been confirmed!',
    order_status_preparing: '👨‍🍳 Your order is being prepared!',
    order_status_ready: '🎁 Your order is ready for pickup/delivery!',
    order_status_delivered: '🏠 Your order has been delivered. Enjoy!',
    order_status_cancelled: '❌ Your order has been cancelled.',
    review_prompt: (orderNum) => `⭐ How was your order \`${orderNum}\`? Please rate your experience:`,
    points_earned: (pts) => `🎉 You earned *${pts} loyalty points* from this order!`,
    referral_bonus: (name) => `🎁 You earned 50 points because *${name}* joined using your referral link!`,
    share_phone: '📱 Please share your phone number to complete vendor registration:',
    admin_weekly_report: '📊 *Weekly Admin Report*',
    vendor_weekly_report: '📊 *Your Weekly Report*',
    help_text: `ℹ️ *Hager Gebeya Help*\n\n*Customer Commands:*\n/start — Welcome screen\n/shop — Open the shop\n/orders — View your orders\n/vendors — Browse vendors\n/points — Your loyalty points\n/refer — Your referral link\n/language — Change language\n\n*Vendor Commands:*\n/become\\_vendor — Apply as vendor\n/vendor\\_dashboard — Manage your shop\n\n*Admin Commands:*\n/admin — Admin dashboard`,
  },
  am: {
    welcome: (name) => `👋 እንኳን ደህና መጡ *ሃገር ገበያ*, ${name}!\n\n🛒 ከአካባቢ ሻጮች ይሸምቱ\n🏷️ ልዩ ቅናሾችን ያግኙ\n📦 ትዕዛዞችዎን ይከታተሉ\n⭐ የቅናሽ ነጥቦችን ያሸንፉ`,
    welcome_back: (name) => `👋 እንደምን ነዎት, ${name}!`,
    open_shop: '🛍️ ሱቅ ክፈት',
    my_orders: '📦 ትዕዛዞቼ',
    help: 'ℹ️ እርዳታ',
    language_set: '✅ ቋንቋ ወደ አማርኛ ተቀይሯል።',
    choose_language: '🌐 Choose your language / ቋንቋ ይምረጡ:',
    vendors_title: '🏪 *ንቁ ሻጮች:*',
    no_vendors: 'ምንም ሻጭ አልተገኘም። ቆየት ብለው ይመልከቱ!',
    become_vendor: '🏪 *ሃገር ገበያ ላይ ሻጭ ይሁኑ*\n\nየሱቅ ዝርዝሮትን ይላኩ ወይም ከዚህ በታች ያለውን ቁልፍ ይጠቀሙ:',
    vendor_pending: (name) => `⏳ ሱቅዎ *${name}* ፍቃድ እየጠበቀ ነው።`,
    vendor_approved_notif: (name) => `🎉 *እንኳን ደስ አለዎት!*\n\nሱቅዎ *${name}* ጸድቋል!\n\nምርቶችን ማከል እና መሸጥ ይችላሉ። ሱቅዎን ለማስተዳደር /vendor_dashboard ይጠቀሙ።`,
    vendor_rejected: (name) => `ይቅርታ፣ *${name}* በዚህ ጊዜ አልጸደቀም። ለተጨማሪ መረጃ ድጋፍን ያነጋግሩ።`,
    new_order_notif: (orderNum, total) => `🆕 *አዲስ ትዕዛዝ!* \`${orderNum}\`\n💰 ጠቅላላ: *${total} ብር*`,
    order_status_confirmed: '✅ ትዕዛዝዎ ተረጋግጧል!',
    order_status_preparing: '👨‍🍳 ትዕዛዝዎ እየተዘጋጀ ነው!',
    order_status_ready: '🎁 ትዕዛዝዎ ለመቀበል/ለመላክ ዝግጁ ነው!',
    order_status_delivered: '🏠 ትዕዛዝዎ ደርሷል። ደስ ይበልዎ!',
    order_status_cancelled: '❌ ትዕዛዝዎ ተሰርዟል።',
    review_prompt: (orderNum) => `⭐ ትዕዛዝ \`${orderNum}\` እንዴት ነበር? ልምድዎን ይገምግሙ:`,
    points_earned: (pts) => `🎉 ከዚህ ትዕዛዝ *${pts} የቅናሽ ነጥቦች* አሸነፉ!`,
    referral_bonus: (name) => `🎁 *${name}* በሪፈራል ሊንክዎ ስለተቀላቀሉ 50 ነጥቦች አሸነፉ!`,
    share_phone: '📱 የሻጭ ምዝገባን ለማጠናቀቅ ስልክ ቁጥርዎን ያጋሩ:',
    admin_weekly_report: '📊 *ሳምንታዊ የአስተዳዳሪ ሪፖርት*',
    vendor_weekly_report: '📊 *የሳምንቱ ሪፖርትዎ*',
    help_text: `ℹ️ *ሃገር ገበያ እርዳታ*\n\n*የደንበኛ ትዕዛዞች:*\n/start — የእንኳን ደህና መጡ ገጽ\n/shop — ሱቅ ክፈት\n/orders — ትዕዛዞችዎን ይመልከቱ\n/vendors — ሻጮችን ያስሱ\n/points — የቅናሽ ነጥቦችዎ\n/refer — የሪፈራል ሊንክዎ\n/language — ቋንቋ ይቀይሩ\n\n*የሻጭ ትዕዛዞች:*\n/become\\_vendor — ሻጭ ለመሆን ያመልክቱ\n/vendor\\_dashboard — ሱቅዎን ያስተዳድሩ`,
  },
};

function t(lang, key, ...args) {
  const dict = translations[lang] || translations.en;
  const val = dict[key] || translations.en[key];
  if (!val) return key;
  return typeof val === 'function' ? val(...args) : val;
}

module.exports = { t, translations };
