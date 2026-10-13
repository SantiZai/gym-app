import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { ActiveSessionBanner } from "@/components/ActiveSessionBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ThemeProvider } from "@/components/theme-provider";
import { SonnerToaster } from "@/components/sonner-toaster";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://habitus.lat"),
  title: {
    default: "Habitus - Entrenamiento con propósito",
    template: "%s | Habitus",
  },
  description: "Gestiona tus rutinas, ejercicios y progreso. Entrenamiento con propósito.",
  keywords: ["habitus", "gimnasio", "rutinas", "entrenamiento", "progreso", "fitness"],
  authors: [{ name: "Habitus" }],
  creator: "Habitus",
  applicationName: "Habitus",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: "https://habitus.lat/",
    siteName: "Habitus",
    title: "Habitus - Entrenamiento con propósito",
    description: "Gestiona tus rutinas, ejercicios y progreso. Entrenamiento con propósito.",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Habitus",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Habitus - Entrenamiento con propósito",
    description: "Gestiona tus rutinas, ejercicios y progreso. Entrenamiento con propósito.",
    images: ["/icons/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  appleWebApp: {
    capable: true,
    title: "Habitus",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icons/favicon-32x32.png",
    apple: "/icons/apple-touch-icon.png",
  },
  verification: {
    google: [
      "VUYkP1Bf88G2x1JXh_AePUzLS0EkYrmoK4mTXmePLNY",
      "52wmuP5njQQpk_C8Dti6v4b5F2S4XhvIJ4Hia6zCk2g",
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <Navbar />
          <main className="pt-[calc(4rem+env(safe-area-inset-top))]">
            {children}
          </main>
          <ActiveSessionBanner />
          <InstallPrompt />
          <ServiceWorkerRegister />
          <SonnerToaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
