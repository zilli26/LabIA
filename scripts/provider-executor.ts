import { loadEnvConfig } from "@next/env";

import { createProviderExecutorServer } from "../lib/provider-connections/executor-service";

loadEnvConfig(process.cwd());

const port = Number(process.env.LABIA_PROVIDER_EXECUTOR_PORT || 4317);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("LABIA_PROVIDER_EXECUTOR_PORT inválida");
}

const server = createProviderExecutorServer();
server.listen(port, "127.0.0.1", () => {
  console.log(`Provider executor do LabIA ativo em http://127.0.0.1:${port}`);
  console.log("Este processo gerencia autenticação local; não consome filas de geração.");
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
