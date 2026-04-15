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
  keywords: ["Daily Predictor", "Uganda football tips", "match analysis", "Metric Data Insights"],
  manifest: "/manifest.json",
  openGraph: {
    title: "Daily Predictor UG - Expert Football Analysis & Daily Tickets",
    description: "Get the best football match analysis and daily prediction tickets in Uganda.",
    url: "https://dailypredictor.site",
    siteName: "Daily Predictor UG",
    locale: "en_UG",
    type: "website",
  },
  verification: {
    google: "HwLffxN7kXaT6BfkGvNmxSYbjUkCB374_dFqDEZ3t9U",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
