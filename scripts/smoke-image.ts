import { loadEnvConfig } from "@next/env";

import { FalProvider } from "../lib/providers/fal";
import {
  ensureDefaultImageWorkspace,
  runImageGenerationInline,
} from "../lib/providers/image-generation-job";

loadEnvConfig(process.cwd());

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const model = getArg("--model") ?? "fal-ai/flux/dev";
  const shouldPersist = process.argv.includes("--persist");
  const prompt =
    getArg("--prompt") ??
    "Foto editorial de uma bancada de laboratorio criativo com luz natural, materiais de design e uma tela mostrando um canvas de automacao.";
  const provider = new FalProvider();
  const params = {
    prompt,
    numImages: 1,
  };
  const estimatedCost = provider.estimateCost(model, params);

  console.log("Smoke test de imagem via fal.ai");
  console.log(`Modelo: ${model}`);
  console.log(`Custo estimado: US$ ${estimatedCost.usd.toFixed(4)} / R$ ${estimatedCost.brl.toFixed(2)}`);

  if (shouldPersist) {
    const workspace = await ensureDefaultImageWorkspace();
    const generation = await runImageGenerationInline({
      workspaceId: workspace.id,
      model,
      prompt,
      params: {
        numImages: 1,
      },
    });
    const firstAsset = generation.assets[0];

    console.log(`Generation: ${generation.id}`);
    console.log(`Status: ${generation.status}`);
    console.log(`Custo real persistido: US$ ${generation.actualCostUsd?.toString()} / R$ ${generation.actualCostBrl?.toString()}`);
    console.log(`Asset Supabase: ${firstAsset?.url ?? "nenhum asset persistido"}`);
    return;
  }

  const result = await provider.generateAndWait(model, params, {
    logs: true,
    pollIntervalMs: 1000,
  });
  const firstImage = result.images[0];

  console.log(`Request fal.ai: ${result.requestId}`);
  console.log(`Custo real calculado: US$ ${result.cost.usd.toFixed(4)} / R$ ${result.cost.brl.toFixed(2)}`);
  console.log(`Imagem: ${firstImage.url}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
