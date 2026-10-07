"use client";

import { useRef } from "react";

/**
 * One-time id for a create request (see `once()` on the server). The same id is sent again on a
 * retry, so a double click or a resubmit after a lost response is not booked twice; `renew()`
 * after a success starts the next request. Created on first use, never during render.
 */
export function useRequestId() {
  const id = useRef<string | null>(null);
  return {
    current: () => (id.current ??= crypto.randomUUID()),
    renew: () => {
      id.current = null;
    },
  };
}
