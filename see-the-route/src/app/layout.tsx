import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "See-the-Route · Accessibility Stress Card",
  description:
    "Stress-test map and routing UIs for colour vision deficiency and low vision. Research demo by Neer Vasa — Monash MIT.",
  metadataBase: new URL("https://scintilla.world"),
  openGraph: {
    title: "See-the-Route",
    description:
      "Stress-test map and routing UIs for colour vision deficiency and low vision.",
    url: "https://scintilla.world/",
    siteName: "See-the-Route",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
