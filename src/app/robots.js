export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/internal/', // Keep admin panel hidden from crawlers
    },
    sitemap: 'https://dailypredictorug.afrozex.com/sitemap.xml',
  };
}
