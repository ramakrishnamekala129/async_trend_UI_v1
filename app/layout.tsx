import type { Metadata } from "next";
import type { Viewport } from "next";
import { DM_Sans, Sora } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans"
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora"
});

export const metadata: Metadata = {
  title: "TrendDates Analytics",
  description: "Vercel-ready UI for TrendDates JSON outputs",
  manifest: "/manifest.webmanifest",
  applicationName: "TrendDates Analytics",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TrendDates Analytics"
  },
  icons: {
    icon: "/icons/icon-512.svg",
    apple: "/icons/icon-192.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#f4f9ff"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${sora.variable}`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
