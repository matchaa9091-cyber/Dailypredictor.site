import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#00D45E",
};

export const metadata = {
  title: "Daily Predictor UG - Expert Football Analysis & Daily Tickets",
  description: "Get the best football match analysis and daily prediction tickets in Uganda. Reliable stats for Sofascore and Flashscore users.",
  keywords: ["Daily Predictor UG", "Football Prediction Uganda", "VIP Football Tips", "Sure Wins Today", "Soccer Betting Analysis", "Afrozex Sports Analysis"],
  alternates: {
    canonical: "https://dailypredictorug.afrozex.com",
  },
  manifest: "/manifest.json",
  applicationName: "Daily Predictor UG",
  appleWebApp: {
    title: "Daily Predictor UG",
  },
  openGraph: {
    title: "Daily Predictor UG - Expert Football Analysis & Daily Tickets",
    description: "Get the best football match analysis and daily prediction tickets in Uganda.",
    url: "https://dailypredictorug.afrozex.com",
    siteName: "Daily Predictor UG",
    locale: "en_UG",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Daily Predictor UG Logo",
      },
    ],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  verification: {
    google: "fdj_7weueDkVSZHRgsZMhqAvTWmd9-SrANRkZQL2MXw",
  },
};

export default function RootLayout({ children }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Daily Predictor UG",
    "url": "https://dailypredictorug.afrozex.com",
    "logo": "https://dailypredictorug.afrozex.com/logo.png"
  };

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
