export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-4 [&_p]:leading-relaxed [&_p]:text-muted-foreground">
      <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm">Draft — last updated by the operator.</p>
      {children}
    </article>
  );
}
