import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import Layout from "@/components/layout/Layout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://servicehub.example.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ServiceHub — Book Local Home Services",
    template: "%s · ServiceHub",
  },
  description:
    "Discover, book and review trusted local home-service providers — cleaning, plumbing, tutoring, fitness and more. Compare ratings, prices and reviews, and pay securely with Stripe.",
  keywords: [
    "home services",
    "local services",
    "book services online",
    "plumbing",
    "cleaning",
    "electrician",
    "tutoring",
    "service marketplace",
  ],
  authors: [{ name: "ServiceHub" }],
  generator: "Next.js",
  applicationName: "ServiceHub",
  creator: "ServiceHub",
  publisher: "ServiceHub",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "ServiceHub",
    title: "ServiceHub — Book Local Home Services",
    description:
      "Discover, book and review trusted local home-service providers.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ServiceHub — Book Local Home Services",
    description:
      "Discover, book and review trusted local home-service providers.",
    creator: "@servicehub",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }],
    shortcut: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-950 text-slate-200 antialiased`}
      >
        <AuthProvider>
          <ToastProvider>
            <Layout>{children}</Layout>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

