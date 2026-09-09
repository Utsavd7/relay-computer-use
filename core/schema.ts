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
    id: z.string().regex(/^[a-z][a-z0-9_-]+$/),
    version: z.number().int().positive(),
    name: z.string(),
    description: z.string(),
    vendor: z.literal('relay-core'),
    supported_versions: z.array(z.string()),
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
    outcomes: z.array(z.object({ text: z.string(), code: z.string() })),
    recoveries: z.array(
      z.object({
        text: z.string(),
        target: LocatorSchema,
        max_attempts: z.number().int().min(1).max(2),
      }),
    ),
    provenance: z.object({
      kind: z.enum(['llm-discovery', 'authored-example']),
      model: z.string(),
      created_at: z.string(),
      run_id: z.string(),
    }),
    approval: z.object({
      state: z.enum(['draft', 'approved']),
      successful_replays: z.number().int().nonnegative(),
      failed_replays: z.number().int().nonnegative(),
      reviewer: z.string().nullable(),
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
export type Policy = {
  routes: string[];
  actions: Action['action'][];
  risky: 'block';
  timeout_ms: number;
  max_steps: number;
  max_retries: number;
};
export const defaultPolicy: Policy = {
  routes: ['/bank.html', '/bank-frame.html'],
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
