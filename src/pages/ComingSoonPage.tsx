export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex h-64 items-center justify-center rounded-md border bg-panel text-muted-foreground shadow-sm border-[oklch(0.84_0_0)]">
        Coming soon
      </div>
    </div>
  )
}
