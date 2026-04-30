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
  keywords: ["Daily Predictor", "Uganda football tips", "match analysis", "Afrozex Sports Analysis"],
  manifest: "/manifest.json",
  openGraph: {
    title: "Daily Predictor UG - Expert Football Analysis & Daily Tickets",
    description: "Get the best football match analysis and daily prediction tickets in Uganda.",
    url: "https://dailypredictorug.afrozex.com",
    siteName: "Daily Predictor UG",
    locale: "en_UG",
    type: "website",
    images: [
      {
        url: "https://dailypredictorug.afrozex.com/logo.png",
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
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
