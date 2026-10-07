"use client";

import "./globals.css";

/**
 * Last resort when the root layout itself fails. It replaces the whole document, so it brings its
 * own <html>/<body> and the global styles (no fonts or theme provider).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ka">
      <body className="flex min-h-dvh items-center justify-center bg-background px-6 text-foreground">
        <title>შეცდომა · AlcoDraft</title>
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">სისტემა დროებით მიუწვდომელია</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            გვერდი ვერ ჩაიტვირთა. სცადეთ თავიდან; თუ პრობლემა განმეორდა, მიმართეთ ადმინისტრატორს.
          </p>
          {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">კოდი: {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => retry()}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            თავიდან ცდა
          </button>
        </div>
      </body>
    </html>
  );
}
