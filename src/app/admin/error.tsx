"use client";

import { ErrorView } from "@/components/error-view";

/** Errors in the panel layout (sidebar) and on the login page — the panel's own boundary sits below them. */
export default function AdminError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView {...props} className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center" />;
}
