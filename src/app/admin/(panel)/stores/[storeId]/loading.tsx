import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return <PageSkeleton stats={3} rows={4} />;
}
