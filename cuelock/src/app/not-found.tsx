"use client";

import { ToolApp } from "@/components/ToolApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";

/** Unknown paths still show CueLock instead of a dead 404 page. */
export default function NotFound() {
  return (
    <ErrorBoundary>
      <ToolApp />
    </ErrorBoundary>
  );
}
