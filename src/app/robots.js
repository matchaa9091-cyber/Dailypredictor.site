export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/admin/', // Keep admin pages private
    },
    sitemap: 'https://dailypredictor.site/sitemap.xml',
  };
}
