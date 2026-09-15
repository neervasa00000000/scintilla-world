"use client";

import { ToolApp } from "@/components/ToolApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function Error() {
  return (
    <ErrorBoundary>
      <ToolApp />
    </ErrorBoundary>
  );
}
