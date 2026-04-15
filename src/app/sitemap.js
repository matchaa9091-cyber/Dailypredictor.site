export default function sitemap() {
  return [
    {
      url: 'https://dailypredictor.site',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    // Add other routes here if you have them, e.g., /about, /vip, etc.
  ];
}
