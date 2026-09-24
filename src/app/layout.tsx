import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { PREFERENCES_SCRIPT } from "@/styles/preferences";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kas Kita", template: "%s · Kas Kita" },
  applicationName: "Kas Kita",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Kas Kita", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

// theme-color harus literal di meta; nilainya sama dengan token --canvas terang dan gelap
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={GeistSans.variable} suppressHydrationWarning>
      <head>
        {/* atribut transparansi dan tema dipasang sebelum paint supaya tidak ada kilatan glass */}
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
