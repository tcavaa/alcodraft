import { SearchX } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function PanelNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </span>
      <h1 className="mt-5 text-xl font-semibold">ვერ მოიძებნა</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        ასეთი ჩანაწერი არ არსებობს, ან ამ მაღაზიაზე წვდომა არ გაქვთ.
      </p>
      <Button className="mt-6" asChild>
        <Link href="/admin">მთავარზე დაბრუნება</Link>
      </Button>
    </div>
  );
}
