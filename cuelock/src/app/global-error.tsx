"use client";

import { ToolApp } from "@/components/ToolApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

export default function GlobalError() {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
        <ErrorBoundary>
          <ToolApp />
        </ErrorBoundary>
      </body>
    </html>
  );
}
