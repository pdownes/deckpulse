import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeckPulse - Live Presentation Feedback",
  description: "Upload presentations, collect real-time audience feedback, and get AI-powered summaries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
