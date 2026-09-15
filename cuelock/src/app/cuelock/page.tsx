import { ToolApp } from "@/components/ToolApp";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CueLock — Semantic navigation cue verifier",
  description: "Semantic navigation cue verifier for web maps. Machado 2009 · CIEDE2000 · dual-encoding gate.",
};

export default function CueLockPage() {
  return (
    <ErrorBoundary>
      <ToolApp />
    </ErrorBoundary>
  );
}
