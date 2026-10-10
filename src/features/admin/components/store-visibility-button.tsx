"use client";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useServerAction } from "@/hooks/use-server-action";

import { setStoreHiddenAction } from "../actions";

/** Overview page: hide a store card, or show a hidden one again (per user). */
export function StoreVisibilityButton({ storeId, name, hidden }: { storeId: number; name: string; hidden: boolean }) {
  const { run, pending } = useServerAction();
  const toggle = () => run(() => setStoreHiddenAction(storeId, !hidden));

  if (hidden) {
    return (
      <Button variant="outline" size="sm" onClick={toggle} disabled={pending}>
        {pending ? <Spinner /> : <Eye />}
        ჩვენება
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      disabled={pending}
      aria-label={`${name} — დამალვა`}
      title="დამალვა მიმოხილვიდან"
      className="text-muted-foreground hover:text-foreground"
    >
      {pending ? <Spinner /> : <EyeOff />}
    </Button>
  );
}
