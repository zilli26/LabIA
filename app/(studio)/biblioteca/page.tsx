export default function LibraryPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8">
      <section className="border-b border-lab-border pb-6">
        <p className="font-mono text-xs uppercase text-lab-text-muted">
          Biblioteca
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          Assets e gerações
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-lab-text-dim">
          Placeholder da biblioteca. O grid de assets entra quando a próxima
          etapa do módulo de imagens for retomada.
        </p>
      </section>

      <section className="rounded-control border border-dashed border-lab-border bg-lab-surface-1 p-8 text-sm text-lab-text-dim">
        Nenhum asset listado por enquanto.
      </section>
    </main>
  );
}
