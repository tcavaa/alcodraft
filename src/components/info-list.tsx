/** Label / value list of a detail card ("ინფორმაცია"). */
export function InfoList({ children }: { children: React.ReactNode }) {
  return <dl className="space-y-2.5 text-sm">{children}</dl>;
}

export function InfoRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
