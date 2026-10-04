import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scintilla — CueLock map accessibility checker",
  description: "Check whether navigation routes and markers stay distinguishable for people with colour vision differences.",
  metadataBase: new URL("https://scintilla.world"),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
