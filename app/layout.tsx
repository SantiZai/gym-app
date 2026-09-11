import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
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
  title: "Habitus - Entrenamiento con propósito",
  description: "Gestiona tus rutinas, ejercicios y progreso. Entrenamiento con propósito.",
  applicationName: "Habitus",
  appleWebApp: {
    capable: true,
    title: "Habitus",
    statusBarStyle: "default",
  },
  icons: {
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
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <Navbar />
          <main className="pt-16">
            {children}
          </main>
          <SonnerToaster />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
