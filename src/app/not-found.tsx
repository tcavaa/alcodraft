import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Wordmark className="text-4xl" />
      <p className="text-6xl font-semibold tracking-tight text-muted-foreground/40">404</p>
      <p className="text-muted-foreground">გვერდი ვერ მოიძებნა.</p>
      <Link href="/" className="text-sm underline underline-offset-4">
        მთავარ გვერდზე
      </Link>
    </main>
  );
}
