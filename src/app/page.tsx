import { ArrowRight, Grape, Store, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Wordmark } from "@/components/brand/wordmark";

const FEATURES = [
  {
    icon: Grape,
    title: "ქართული ღვინო",
    text: "რქაწითელი, საფერავი, მუკუზანი, ქინძმარაული და სხვა — ჩამოსასხმელი და ჩამოსხმული.",
  },
  {
    icon: Truck,
    title: "დისტრიბუცია",
    text: "რეგულარული მიწოდება რესტორნებს, ბარებსა და მაღაზიებს თბილისსა და ბათუმში.",
  },
  {
    icon: Store,
    title: "პარტნიორი სახლები",
    text: "ვთანამშრომლობთ ღვინის სახლებთან და ვაწვდით მათ პროდუქციას საიმედოდ და დროულად.",
  },
];

export default function HomePage() {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Wordmark className="text-3xl" />
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-gold hover:text-foreground"
        >
          თანამშრომლებისთვის <ArrowRight className="size-3.5" />
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-10 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <p className="text-sm tracking-[0.25em] text-gold uppercase">Wine &amp; spirits distribution</p>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] font-semibold text-balance md:text-6xl">
              ღვინო, რომელიც <span className="text-gold">ხალხამდე</span> მიდის.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              AlcoDraft არის ქართული ღვინისა და ალკოჰოლური სასმელების დისტრიბუციის კომპანია. ჩვენ ვაკავშირებთ ღვინის
              სახლებს რესტორნებთან, ბარებთან და მაღაზიებთან — ყოველდღიური, ზუსტი და სანდო მიწოდებით.
            </p>
            <div className="gold-rule mt-10 h-px w-full max-w-md opacity-60" />
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 rounded-[2rem] bg-gold/10 blur-3xl" aria-hidden />
            <Image
              src="/brand/alcodraft.jpg"
              alt="AlcoDraft"
              width={960}
              height={950}
              priority
              className="relative rounded-[1.75rem] border border-gold/20 shadow-2xl"
              sizes="(min-width: 1024px) 28rem, 90vw"
            />
          </div>
        </section>

        <section className="border-t border-border/60 bg-card/40">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-border/60 bg-background/40 p-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <f.icon className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-10 text-sm text-muted-foreground sm:flex-row">
        <Wordmark className="text-xl" />
        <span>alcodraft.ge</span>
      </footer>
    </div>
  );
}
