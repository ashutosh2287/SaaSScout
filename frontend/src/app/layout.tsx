import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceStatusBar } from "@/components/layout/ServiceStatusBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Sasscout — SaaS-spend audit for small businesses",
    template: "%s · Sasscout",
  },
  description:
    "Sasscout is a software-spend audit tool for small businesses. Upload your transaction data and see what software spending deserves a closer look.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceStatusBar />
        {children}
      </body>
    </html>
  );
}
