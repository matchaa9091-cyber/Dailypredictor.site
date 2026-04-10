import "./globals.css";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#00D45E",
};

export const metadata = {
  title: "PredictorUG - Expert Daily Tickets",
  description: "Get researched football accumulators with expert analysis. The most reliable betting predictions in Uganda.",
  manifest: "/manifest.json",
  openGraph: {
    title: "PredictorUG - Expert Winning Tickets",
    description: "Expertly researched football accumulators with pro analysis.",
    url: "https://predictor-ug.vercel.app",
    siteName: "PredictorUG",
    locale: "en_UG",
    type: "website",
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
