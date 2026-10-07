"use client";

import { ErrorView } from "@/components/error-view";

export default function PanelError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView {...props} />;
}
