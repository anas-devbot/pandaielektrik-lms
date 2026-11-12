import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

// Fon ikut DESIGN.md: Fraunces untuk tajuk, Source Sans 3 untuk badan dan borang.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

// Asas URL untuk pautan mutlak dalam tag Open Graph (gambar pratonton WhatsApp/Facebook/Telegram).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://pandaielektrik.com"),
  title: "Pandai Elektrik",
  description: "Kursus elektrik AHZ Teknik",
  openGraph: { siteName: "Pandai Elektrik", locale: "ms_MY", type: "website" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ms"
      className={`${fraunces.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
