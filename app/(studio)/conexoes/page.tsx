import { ConnectionManager } from "@/components/providers/connection-manager";

export default function ConnectionsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-lab-reagent-bright">
          Conexões
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-lab-text">
          Providers do laboratório
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-lab-text-dim">
          Gerencie contas e executores sem misturar login com capacidade ou
          validação de geração. Cada nó gerativo escolherá Provider → Conexão →
          Modelo.
        </p>
      </div>

      <ConnectionManager />
    </main>
  );
}
