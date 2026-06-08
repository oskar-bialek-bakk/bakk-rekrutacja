import { z } from 'zod';

const BlockId = z.enum(['A', 'B', 'C', 'D', 'E']);
const Mark = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const Decision = z.enum(['yes', 'no', 'wait']);

const Candidate = z.object({
  nameOrId: z.string(),
  date: z.string(),
  stage1Result: z.string(),
  stage1Note: z.string(),
});

const Negotiation = z.object({
  oczekiwania: z.string(),
  widelki: z.string(),
  formaUmowy: z.string(),
  dostepnosc: z.string(),
  uwagi: z.string(),
});

const TimerState = z.object({
  elapsedSec: z.number(),
  paused: z.boolean(),
  offsetSec: z.number(),
  phase45Notified: z.boolean().optional(),
});

const Flags = z.object({ red: z.boolean(), green: z.boolean() });

const partialByBlock = <T extends z.ZodTypeAny>(value: T) =>
  z.record(BlockId, value).optional().default({});

export const AssessmentSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int(),
  candidate: Candidate,
  selectedVariants: partialByBlock(z.number().int()),
  deepenAsked: partialByBlock(z.boolean()),
  marks: partialByBlock(Mark),
  flags: partialByBlock(Flags),
  notes: partialByBlock(z.string()),
  decision: Decision.nullable(),
  decisionNote: z.string(),
  askedQuestions: partialByBlock(z.record(z.string(), z.boolean())),
  negotiation: Negotiation,
  timer: TimerState,
  blockTimes: z.record(BlockId, z.number()).optional().default({}),
  useE: z.boolean(),
  useAChart: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Assessment = z.infer<typeof AssessmentSchema>;

/** Assessment as stored in Cosmos: extends client shape with userPrincipalName partition key. */
export const StoredAssessmentSchema = AssessmentSchema.extend({
  userPrincipalName: z.string(),
});

export type StoredAssessment = z.infer<typeof StoredAssessmentSchema>;

export const VariantUsageSchema = z.object({
  id: z.string(),
  scope: z.string(),
  counts: z.object({
    A: z.array(z.number().int().nonnegative()),
    B: z.array(z.number().int().nonnegative()),
    C: z.array(z.number().int().nonnegative()),
    D: z.array(z.number().int().nonnegative()),
  }),
});

export type VariantUsage = z.infer<typeof VariantUsageSchema>;

export const VariantUsageIncrementSchema = z.object({
  block: z.enum(['A', 'B', 'C', 'D']),
  variantIdx: z.number().int().nonnegative(),
});

const Weights = z.object({
  A: z.number(),
  B: z.number(),
  C: z.number(),
  D: z.number(),
  E: z.number(),
});

export const SettingsSchema = z.object({
  userPrincipalName: z.string(),
  weights: Weights,
  showScoreLive: z.boolean(),
  includeEInScore: z.boolean(),
});

export type StoredSettings = z.infer<typeof SettingsSchema>;

export const SettingsInputSchema = SettingsSchema.omit({ userPrincipalName: true });
