import "./globals.css";
export const metadata = {
  title: "PredictorUG - Daily Safe Tickets",
  description: "AI-Powered football accumulators with live data and Claude analysis.",
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
