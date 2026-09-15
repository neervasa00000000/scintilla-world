import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f1113] px-6 text-center text-[#e8eaed]">
      <h2 className="mb-4 text-2xl font-bold">Page not found</h2>
      <p className="mb-8 text-[#8b929a]">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="rounded-md border border-[#2a2f36] bg-[#171a1d] px-6 py-2.5 text-sm font-semibold transition hover:border-[#3a414a] hover:bg-[#1c2024]"
      >
        Return Home
      </Link>
    </div>
  );
}
