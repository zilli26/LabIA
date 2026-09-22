import { z } from "zod";

const nonEmptyId = z.string().trim().min(1).max(200);
const boundedText = (max: number) => z.string().trim().max(max);

export const projectStatusSchema = z.enum(["DRAFT", "IN_PROGRESS", "REVIEW", "APPROVED", "ARCHIVED"]);
export const projectAssetRoleSchema = z.enum(["source", "reference", "audio"]);
export const flowTemplateSchema = z.enum(["product-imported-to-video", "product-production-blueprint"]);

export const getCapabilitiesInputSchema = z.object({}).strict();
export const listProjectsInputSchema = z.object({
  status: projectStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(24),
}).strict();
export const getProjectInputSchema = z.object({ projectId: nonEmptyId }).strict();
export const listAssetsInputSchema = z.object({
  projectId: nonEmptyId,
  role: projectAssetRoleSchema.optional(),
}).strict();
export const getFlowInputSchema = z.object({ flowId: nonEmptyId }).strict();

export const draftIntentSchema = z.object({
  name: boundedText(160).min(1),
  objective: boundedText(5000).min(1),
  aspectRatio: z.string().trim().regex(/^\d{1,2}:\d{1,2}$/),
  durationSeconds: z.number().int().min(1).max(3600),
  briefing: boundedText(10000).min(1),
}).strict();

export const createFlowDraftInputSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(200),
  template: flowTemplateSchema,
  intent: draftIntentSchema,
}).strict();

const flowNodeDataSchema = z.object({
  kind: z.enum([
    "text-input", "asset-input", "note", "asset-output", "prompt",
    "image-generation", "video-generation", "video-extend", "video-assembly", "text2video",
  ]),
  title: z.string(),
  description: z.string(),
  status: z.enum(["idle", "ready", "queued", "running", "done", "failed"]),
  costLabel: z.string().optional(),
  extendChainDepth: z.number().int().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

const flowNodeSchema = z.object({
  id: nonEmptyId,
  type: z.string(),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).passthrough(),
  data: flowNodeDataSchema,
}).passthrough();

const flowEdgeSchema = z.object({
  id: nonEmptyId,
  source: nonEmptyId,
  target: nonEmptyId,
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  type: z.string().optional(),
}).passthrough();

export const flowGraphSchema = z.object({
  nodes: z.array(flowNodeSchema).max(500),
  edges: z.array(flowEdgeSchema).max(1000),
  viewport: z.object({ x: z.number().finite(), y: z.number().finite(), zoom: z.number().finite() }).optional(),
}).passthrough();

export const saveFlowDraftInputSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(200),
  flowId: nonEmptyId,
  name: boundedText(160).min(1),
  graph: flowGraphSchema,
  expectedGraphHash: z.string().regex(/^[a-f0-9]{64}$/i).nullable().optional(),
}).strict();

export const estimateFlowInputSchema = z.object({
  flowId: nonEmptyId,
  targetNodeId: nonEmptyId.nullable().optional(),
}).strict();

export type GetCapabilitiesInput = z.infer<typeof getCapabilitiesInputSchema>;
export type ListProjectsInput = z.infer<typeof listProjectsInputSchema>;
export type GetProjectInput = z.infer<typeof getProjectInputSchema>;
export type ListAssetsInput = z.infer<typeof listAssetsInputSchema>;
export type GetFlowInput = z.infer<typeof getFlowInputSchema>;
export type CreateFlowDraftInput = z.infer<typeof createFlowDraftInputSchema>;
export type SaveFlowDraftInput = z.infer<typeof saveFlowDraftInputSchema>;
export type EstimateFlowInput = z.infer<typeof estimateFlowInputSchema>;
