"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function PanelError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </span>
      <h1 className="mt-5 text-xl font-semibold">რაღაც შეცდომა მოხდა</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        გვერდი ვერ ჩაიტვირთა. სცადეთ თავიდან; თუ პრობლემა განმეორდა, მიმართეთ ადმინისტრატორს.
        {error.digest ? <span className="mt-2 block font-mono text-xs">კოდი: {error.digest}</span> : null}
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw />
          თავიდან ცდა
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin">მთავარზე</Link>
        </Button>
      </div>
    </div>
  );
}
