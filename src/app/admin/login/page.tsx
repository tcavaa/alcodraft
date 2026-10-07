import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/auth/login-form";
import { HOME_PATH } from "@/server/auth/constants";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "შესვლა", robots: { index: false } };

export default function LoginPage(props: PageProps<"/admin/login">) {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-sidebar lg:block">
        <Image
          src="/brand/alcodraft.jpg"
          alt=""
          fill
          priority
          sizes="55vw"
          className="object-cover object-center opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/20 to-transparent" />
        <div className="absolute inset-x-12 bottom-12 text-sidebar-foreground">
          <p className="font-display text-3xl leading-tight text-gold">ღვინო, რომელიც ხალხამდე მიდის.</p>
          <p className="mt-3 max-w-md text-sm text-sidebar-foreground/70">
            გაყიდვები, საწყობი, ვალები და ფინანსები — ყველა მაღაზია ერთ სისტემაში.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Wordmark className="mb-10 text-4xl" />
          <h1 className="text-2xl font-semibold tracking-tight">შესვლა</h1>
          <p className="mt-1.5 mb-8 text-sm text-muted-foreground">მართვის პანელი — მხოლოდ თანამშრომლებისთვის.</p>
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginGate searchParams={props.searchParams} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

async function LoginGate({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  if (await getCurrentUser()) redirect(HOME_PATH);
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-11 w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
