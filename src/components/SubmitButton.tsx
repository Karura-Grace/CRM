"use client";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/** Submit button that disables while pending and optionally asks for confirmation. */
export default function SubmitButton({
  children,
  className = "btn-primary",
  confirm,
  name,
  value,
}: {
  children: ReactNode;
  className?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
