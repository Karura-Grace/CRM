import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1>Not found</h1>
      <p className="muted mt-2">That record or page doesn&apos;t exist (it may have been deleted).</p>
      <Link href="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
    </div>
  );
}
