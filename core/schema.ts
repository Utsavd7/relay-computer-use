import { z } from 'zod';
export const LocatorSchema = z
  .object({
    kind: z.enum(['control', 'text', 'field']),
    name: z.string().min(1).max(120),
  })
  .strict();
export const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('click'), target: LocatorSchema }).strict(),
  z
    .object({
      action: z.literal('fill'),
      target: LocatorSchema,
      input: z.literal('member_id'),
    })
    .strict(),
  z
    .object({
      action: z.literal('read'),
      target: LocatorSchema,
      output: z.literal('balance'),
    })
    .strict(),
]);
export const ArtifactSchema = z
  .object({
    schema_version: z.literal('1.0'),
    id: z
      .string()
      .max(100)
      .regex(/^[a-z][a-z0-9_-]+$/),
    version: z.number().int().positive(),
    name: z.string().min(1).max(120),
    description: z.string().max(500),
    vendor: z.literal('relay-core'),
    supported_versions: z.array(z.string().min(1).max(30)).min(1).max(10),
    inputs: z.object({
      member_id: z.object({
        type: z.literal('string'),
        pattern: z.literal('^\\d{5}$'),
        sensitive: z.literal(true),
      }),
    }),
    outputs: z.object({
      balance: z.literal('number'),
      currency: z.literal('string'),
    }),
    steps: z.array(ActionSchema).min(2).max(30),
    checkpoint: z.object({
      text: z.literal('Account overview'),
      identity_field: z.literal('Member ID'),
    }),
    outcomes: z
      .array(
        z
          .object({
            text: z.string().min(1).max(120),
            code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
          })
          .strict(),
      )
      .max(10),
    recoveries: z
      .array(
        z.object({
          text: z.string().min(1).max(120),
          target: LocatorSchema,
          max_attempts: z.number().int().min(1).max(2),
        }),
      )
      .max(10),
    provenance: z.object({
      kind: z.enum(['llm-discovery', 'authored-example']),
      model: z.string().max(150),
      created_at: z.string().max(50),
      run_id: z.string().max(100),
    }),
    approval: z.object({
      state: z.enum(['draft', 'approved']),
      successful_replays: z.number().int().nonnegative(),
      failed_replays: z.number().int().nonnegative(),
      reviewer: z.string().max(100).nullable(),
    }),
  })
  .strict();
export type Artifact = z.infer<typeof ArtifactSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Locator = z.infer<typeof LocatorSchema>;
export const ParamsSchema = z
  .object({ member_id: z.string().regex(/^\d{5}$/) })
  .strict();
export type Params = z.infer<typeof ParamsSchema>;
export type Observation = {
  text: string;
  controls: {
    ref: number;
    name: string;
    kind: 'control' | 'field' | 'text';
    state?: 'empty' | 'filled';
  }[];
};
export type Event = {
  time: string;
  type: string;
  step: number;
  detail: unknown;
};
export type Result = {
  status: 'success' | 'business_outcome' | 'failure';
  code: string;
  outputs?: { balance: number; currency: string };
  step: number;
  expected?: string;
  observed?: string;
  model_calls: number;
  assisted: boolean;
  run_id: string;
};
export const safeControls = {
  click: [
    'Search members',
    'Find member',
    'Open member',
    'Savings account',
    'Back to search',
    'Retry load',
    'Dismiss notice',
    'Restore session',
  ],
  fill: ['Member ID'],
  read: ['Savings balance'],
};
export const PolicySchema = z
  .object({
    routes: z
      .array(z.enum(['/bank.html', '/bank-frame.html', '/bank', '/bank-frame']))
      .min(1)
      .max(4),
    actions: z
      .array(z.enum(['click', 'fill', 'read']))
      .min(1)
      .max(3),
    risky: z.literal('block'),
    timeout_ms: z.number().int().min(1).max(30000),
    max_steps: z.number().int().min(1).max(50),
    max_retries: z.number().int().min(0).max(2),
    model_timeout_ms: z.number().int().min(1).max(60000).default(60000),
  })
  .strict();
export type Policy = z.input<typeof PolicySchema>;
export const defaultPolicy: Policy = {
  routes: ['/bank.html', '/bank-frame.html', '/bank', '/bank-frame'],
  actions: ['click', 'fill', 'read'],
  risky: 'block',
  timeout_ms: 6000,
  max_steps: 25,
  max_retries: 2,
};
export type Surface = {
  observe(): Promise<Observation>;
  act(
    action: Action,
    params: Params,
  ): Promise<{ balance: number; currency: string } | undefined>;
  has(text: string): Promise<boolean>;
  identity(): Promise<string>;
  route(): string;
  version(): string;
  evidence(): Promise<string>;
  onHumanAction?(listener: (detail: unknown) => void): () => void;
};
export interface Model {
  name: string;
  decide(
    goal: string,
    observation: Observation,
    history: unknown[],
  ): Promise<unknown>;
}
export const DecisionSchema = z.object({
  action: z.enum(['click', 'fill', 'read', 'done']),
  target: z.number().int().optional(),
  input: z.literal('member_id').optional(),
  reason: z.string().max(250),
});

/** File imports are untrusted; validation and approval must be earned on this device. */
export function importArtifact(value: unknown): Artifact {
  const artifact = ArtifactSchema.parse(value);
  artifact.approval = {
    state: 'draft',
    successful_replays: 0,
    failed_replays: 0,
    reviewer: null,
  };
  return artifact;
}
