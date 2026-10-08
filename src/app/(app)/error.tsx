"use client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg text-center">
      <h2>Something went wrong</h2>
      <p className="muted mt-2">{error.message.startsWith("Forbidden") ? error.message : "The action could not be completed. Check the server log for details."}</p>
      {error.digest && <p className="mt-1 text-xs text-slate-400">Ref: {error.digest}</p>}
      <button className="btn-primary mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
