import { z } from 'zod';

const BlockId = z.enum(['A', 'B', 'C', 'D', 'E']);
// Mark: front uzywa 1-5 ale akceptujemy szerszy zakres int zeby nie odrzucac legacy danych z localStorage.
const Mark = z.number().int().min(0).max(10);
const Decision = z.enum(['yes', 'no', 'wait']);

// Wszystkie pola domyslnie '' zeby legacy localStorage docs bez tych pol nie byly odrzucane.
const Candidate = z.object({
  nameOrId: z.string().optional().default(''),
  date: z.string().optional().default(''),
  stage1Result: z.string().optional().default(''),
  stage1Note: z.string().optional().default(''),
}).passthrough();

const Negotiation = z.object({
  oczekiwania: z.string().optional().default(''),
  widelki: z.string().optional().default(''),
  formaUmowy: z.string().optional().default(''),
  dostepnosc: z.string().optional().default(''),
  uwagi: z.string().optional().default(''),
}).passthrough();

const TimerState = z.object({
  elapsedSec: z.number().optional().default(0),
  paused: z.boolean().optional().default(false),
  offsetSec: z.number().optional().default(0),
  phase45Notified: z.boolean().optional(),
}).passthrough();

const Flags = z.object({
  red: z.boolean().optional().default(false),
  green: z.boolean().optional().default(false),
}).passthrough();

const partialByBlock = <T extends z.ZodTypeAny>(value: T) =>
  z.record(BlockId, value).optional().default({});

export const AssessmentSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().optional().default(2),
  candidate: Candidate,
  selectedVariants: partialByBlock(z.number().int()),
  deepenAsked: partialByBlock(z.boolean()),
  marks: partialByBlock(Mark),
  flags: partialByBlock(Flags),
  notes: partialByBlock(z.string()),
  decision: Decision.nullable().optional().default(null),
  decisionNote: z.string().optional().default(''),
  askedQuestions: partialByBlock(z.record(z.string(), z.boolean())),
  negotiation: Negotiation.optional().default({
    oczekiwania: '', widelki: '', formaUmowy: '', dostepnosc: '', uwagi: '',
  }),
  timer: TimerState.optional().default({ elapsedSec: 0, paused: false, offsetSec: 0 }),
  blockTimes: z.record(BlockId, z.object({ spentSec: z.number() }).passthrough()).optional().default({}),
  useE: z.boolean().optional().default(false),
  useAChart: z.boolean().optional().default(false),
  createdAt: z.string().optional().default(() => new Date().toISOString()),
  updatedAt: z.string().optional().default(() => new Date().toISOString()),
}).passthrough();

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
