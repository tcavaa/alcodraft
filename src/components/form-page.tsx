import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** A "new …" / "edit …" page: header with a back link and the form in a centred card. */
export function FormPage({
  back,
  eyebrow,
  title,
  description,
  width = "2xl",
  children,
}: {
  back: { href: string; label: string };
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  width?: "xl" | "2xl";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto", width === "xl" ? "max-w-xl" : "max-w-2xl")}>
      <PageHeader back={back} eyebrow={eyebrow} title={title} description={description} />
      <Card>
        <CardContent className="pt-6">{children}</CardContent>
      </Card>
    </div>
  );
}
