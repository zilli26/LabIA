export const PROVIDER_CAPABILITY_KEYS = [
  "text_generation",
  "image_generation",
  "image_editing",
  "image_references",
] as const;

export type ProviderCapabilityKey = (typeof PROVIDER_CAPABILITY_KEYS)[number];
export type ProviderCapabilityStatus = "unverified" | "available" | "unavailable" | "error";
export type ProviderConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "expired"
  | "error";
export type ProviderExecutorStatus = "offline" | "starting" | "online" | "error";
export type GenerationValidationStatus = "unvalidated" | "validated" | "failed";
export type OpenAiLoginMethod = "chatgpt" | "chatgptDeviceCode";

export type ProviderCapabilityDto = {
  key: ProviderCapabilityKey;
  status: ProviderCapabilityStatus;
  evidence: string | null;
  verifiedAt: string | null;
};

export type ProviderConnectionDto = {
  id: string;
  provider: string;
  label: string;
  authMethod: string;
  authStatus: ProviderConnectionStatus;
  executorStatus: ProviderExecutorStatus;
  accountLabel: string | null;
  planType: string | null;
  loginExpiresAt: string | null;
  connectedAt: string | null;
  lastCheckedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  generationValidationStatus: GenerationValidationStatus;
  capabilities: ProviderCapabilityDto[];
};

export type LoginInstruction =
  | {
      type: "chatgpt";
      authUrl: string;
      expiresAt: string;
    }
  | {
      type: "chatgptDeviceCode";
      verificationUrl: string;
      userCode: string;
      expiresAt: string;
    };

export type ExecutorAccountStatus = {
  authStatus: ProviderConnectionStatus;
  executorStatus: ProviderExecutorStatus;
  accountLabel: string | null;
  planType: string | null;
  loginExpiresAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};
