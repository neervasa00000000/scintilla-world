import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "See-the-Route",
  description:
    "In-browser CVD confusable-pair instrument for map and route UIs. Machado et al. 2009 · CIEDE2000.",
  metadataBase: new URL("https://scintilla.world"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>{children}</body>
    </html>
  );
}
