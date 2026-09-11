export type ProviderConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "expired"
  | "error";

export type ProviderExecutorState =
  | "stopped"
  | "starting"
  | "ready"
  | "error";

export type ProviderCapabilityState =
  | "unverified"
  | "verified"
  | "unavailable"
  | "error";

export type ProviderConnectionView = {
  id: string;
  workspaceId: string;
  ownerKey: string;
  provider: string;
  authMethod: string;
  connectionState: ProviderConnectionState;
  executorState: ProviderExecutorState;
  capabilityState: ProviderCapabilityState;
  accountLabel: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  generationValidated: boolean;
};

export type ProviderLoginPrompt =
  | {
      type: "chatgpt";
      authUrl: string;
    }
  | {
      type: "chatgptDeviceCode";
      verificationUrl: string;
      userCode: string;
    };
