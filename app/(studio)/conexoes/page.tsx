import { ProviderConnectionsPanel } from "@/components/providers/provider-connections-panel";

export default function ConnectionsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-lab-reagent-bright">O1 · local</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Conexões</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-lab-text-dim">
          Conecte sua conta ChatGPT em um passo. O executor roda separado do worker de geração e o estado de capacidade permanece independente do estado da conta.
        </p>
      </div>
      <ProviderConnectionsPanel />
    </main>
  );
}
