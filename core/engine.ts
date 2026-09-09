import {
  ActionSchema,
  ArtifactSchema,
  DecisionSchema,
  ParamsSchema,
  PolicySchema,
  type Observation,
  defaultPolicy,
  type Action,
  type Artifact,
  type Event,
  type Model,
  type Params,
  type Policy,
  type Result,
  type Surface,
} from './schema';
import { redact } from './privacy';
export const catalogDescription = {
  name: 'get_savings_balance',
  description: 'Read a member savings balance through the live banking UI.',
  inputSchema: {
    type: 'object',
    properties: { member_id: { type: 'string', pattern: '^\\d{5}$' } },
    required: ['member_id'],
    additionalProperties: false,
  },
};
export function newArtifact(
  steps: Action[],
  model: string,
  runId: string,
): Artifact {
  return ArtifactSchema.parse({
    schema_version: '1.0',
    id: 'get_savings_balance',
    version: 1,
    name: 'Savings balance',
    description: catalogDescription.description,
    vendor: 'relay-core',
    supported_versions: ['1.0', '1.1'],
    inputs: {
      member_id: { type: 'string', pattern: '^\\d{5}$', sensitive: true },
    },
    outputs: { balance: 'number', currency: 'string' },
    steps,
    checkpoint: { text: 'Account overview', identity_field: 'Member ID' },
    outcomes: [
      { text: 'Member not found', code: 'MEMBER_NOT_FOUND' },
      { text: 'Validation error', code: 'VALIDATION_ERROR' },
    ],
    recoveries: [
      {
        text: 'Temporary connection error',
        target: { kind: 'control', name: 'Retry load' },
        max_attempts: 2,
      },
      {
        text: 'Service notice',
        target: { kind: 'control', name: 'Dismiss notice' },
        max_attempts: 1,
      },
    ],
    provenance: {
      kind: 'llm-discovery',
      model,
      created_at: new Date().toISOString(),
      run_id: runId,
    },
    approval: {
      state: 'draft',
      successful_replays: 0,
      failed_replays: 0,
      reviewer: null,
    },
  });
}
export type Intervention = {
  run_id: string;
  step: number;
  reason: string;
  evidence: string;
  owner: 'human';
  context: { goal?: string; capability?: { id: string; version: number } };
};
export class Runner {
  readonly runId = crypto.randomUUID();
  events: Event[] = [];
  owner: 'automation' | 'human' | 'stopped' = 'automation';
  modelCalls = 0;
  assisted = false;
  cancelled = false;
  private release?: () => void;
  private cancellation = new AbortController();
  private context: Intervention['context'] = {};
  private currentStep = 0;
  constructor(
    public surface: Surface,
    public policy: Policy = defaultPolicy,
    private emit?: (event: Event) => void,
    private onIntervention?: (request: Intervention) => void,
  ) {
    this.policy = PolicySchema.parse(policy);
  }
  log(type: string, step: number, detail: unknown) {
    const event = {
      time: new Date().toISOString(),
      type,
      step,
      detail: redact(detail),
    };
    this.events.push(event);
    this.emit?.(event);
  }
  cancel() {
    this.cancelled = true;
    this.cancellation.abort();
    this.owner = 'stopped';
    this.release?.();
  }
  resume() {
    if (this.owner !== 'human') throw Error('NOT_HUMAN_OWNED');
    this.log('control.returned', this.currentStep, { owner: 'automation' });
    this.owner = 'automation';
    this.release?.();
  }
  private async handoff(step: number, reason: string) {
    if (!this.onIntervention) throw Error(reason);
    this.owner = 'human';
    this.currentStep = step;
    const evidence = await this.surface.evidence();
    this.log('control.transferred', step, { owner: 'human', reason, evidence });
    const detach = this.surface.onHumanAction?.((d) =>
      this.log('human.action', step, d),
    );
    try {
      await new Promise<void>((resolve) => {
        this.release = resolve;
        this.onIntervention!({
          run_id: this.runId,
          step,
          reason,
          evidence,
          owner: 'human',
          context: this.context,
        });
      });
    } finally {
      detach?.();
      this.release = undefined;
    }
    if (this.cancelled) throw Error('CANCELLED');
  }
  private check() {
    if (this.cancelled) throw Error('CANCELLED');
    if (this.owner !== 'automation') throw Error('CONTROL_NOT_OWNED');
  }
  private result(
    status: Result['status'],
    code: string,
    step: number,
    extra: Partial<Result> = {},
  ): Result {
    this.owner = 'stopped';
    const result = {
      status,
      code,
      step,
      model_calls: this.modelCalls,
      assisted: this.assisted,
      run_id: this.runId,
      ...extra,
    };
    this.log('run.completed', step, result);
    return result;
  }
  private async decide(
    model: Model,
    goal: string,
    observation: Observation,
    history: unknown[],
  ) {
    this.check();
    this.modelCalls++;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onCancel: () => void = () => {};
    const interrupted = new Promise<never>((_, reject) => {
      onCancel = () => reject(Error('CANCELLED'));
      this.cancellation.signal.addEventListener('abort', onCancel, {
        once: true,
      });
      timer = setTimeout(
        () => reject(Error('MODEL_TIMEOUT')),
        this.policy.model_timeout_ms ?? 60000,
      );
    });
    try {
      const decision = await Promise.race([
        model.decide(
          String(redact(goal)),
          redact(observation) as Observation,
          redact(history) as unknown[],
        ),
        interrupted,
      ]);
      this.check();
      return decision;
    } finally {
      clearTimeout(timer);
      this.cancellation.signal.removeEventListener('abort', onCancel);
    }
  }
  private async action(action: Action, params: Params, step: number) {
    this.check();
    ActionSchema.parse(action);
    this.log('action.start', step, action);
    const value = await this.surface.act(action, params);
    this.log('action.complete', step, {
      action: action.action,
      target: action.target,
    });
    return value;
  }
  async discover(
    goal: string,
    rawParams: unknown,
    model: Model,
  ): Promise<{ result: Result; artifact?: Artifact }> {
    let step = 0;
    const actions: Action[] = [];
    const history: unknown[] = [];
    let outputs: Result['outputs'];
    let consecutiveErrors = 0;
    const started = Date.now();
    try {
      const pp = ParamsSchema.safeParse(rawParams);
      if (!pp.success) throw Error('INVALID_INPUT');
      const params = pp.data;
      if (!goal.trim() || goal.length > 500) throw Error('INVALID_GOAL');
      if (
        !/\bbalance\b/i.test(goal) ||
        /transfer|delete|close account|open account/i.test(goal)
      )
        throw Error('UNSUPPORTED_GOAL');
      this.context = { goal: String(redact(goal)) };
      this.log('discovery.started', 0, {
        model: model.name,
        goal: redact(goal),
        route: this.surface.route(),
      });
      for (; step < this.policy.max_steps; step++) {
        this.check();
        if (Date.now() - started > 180000) throw Error('DISCOVERY_TIMEOUT');
        try {
          const observation = await this.surface.observe();
          this.log('observation', step, observation);
          const raw = await this.decide(model, goal, observation, history);
          const decision = DecisionSchema.parse(raw);
          this.log('model.decision', step, decision);
          if (decision.action === 'done') {
            if (
              !outputs ||
              !(await this.surface.has('Account overview')) ||
              (await this.surface.identity()) !== params.member_id
            )
              throw Error('CHECKPOINT_FAILED');
            const artifact = newArtifact(actions, model.name, this.runId);
            this.log('artifact.created', step, {
              id: artifact.id,
              steps: actions.length,
            });
            return {
              result: this.result('success', 'OK', step, { outputs }),
              artifact,
            };
          }
          const target = observation.controls.find(
            (c) => c.ref === decision.target,
          );
          if (!target) throw Error('MODEL_TARGET_INVALID');
          if (
            (decision.action === 'read' && target.kind !== 'text') ||
            (decision.action === 'fill' && target.kind !== 'field') ||
            (decision.action === 'click' && target.kind !== 'control')
          )
            throw Error('MODEL_ACTION_TYPE_INVALID');
          const loc = { kind: target.kind, name: target.name };
          const action: Action =
            decision.action === 'fill'
              ? { action: 'fill', target: loc, input: 'member_id' }
              : decision.action === 'read'
                ? { action: 'read', target: loc, output: 'balance' }
                : { action: 'click', target: loc };
          if (
            actions.slice(-3).length === 3 &&
            actions
              .slice(-3)
              .every((a) => JSON.stringify(a) === JSON.stringify(action))
          )
            throw Error('NO_PROGRESS');
          outputs = (await this.action(action, params, step)) || outputs;
          actions.push(action);
          history.push({ action: decision.action, target: target.name });
          consecutiveErrors = 0;
          if (
            outputs &&
            (await this.surface.has('Account overview')) &&
            (await this.surface.identity()) === params.member_id
          ) {
            const artifact = newArtifact(actions, model.name, this.runId);
            this.log('checkpoint.verified', step, {
              text: 'Account overview',
              identity: 'matched',
            });
            this.log('artifact.created', step, {
              id: artifact.id,
              steps: actions.length,
            });
            return {
              result: this.result('success', 'OK', step, { outputs }),
              artifact,
            };
          }
          await new Promise((r) => setTimeout(r, 200));
        } catch (e) {
          const reason =
            e instanceof Error ? e.message : 'INVALID_MODEL_DECISION';
          this.log('discovery.blocked', step, { reason });
          if (reason.startsWith('POLICY') || this.cancelled) throw e;
          history.push({
            rejected: reason,
            instruction: 'Inspect the current screen; choose a valid action.',
          });
          consecutiveErrors++;
          if (
            consecutiveErrors >= 2 ||
            reason === 'NO_PROGRESS' ||
            reason === 'MODEL_TIMEOUT'
          ) {
            await this.handoff(step, reason);
            consecutiveErrors = 0;
            history.push({
              human_intervention:
                'Completed; inspect current screen before continuing.',
            });
          }
        }
      }
      throw Error('MAX_STEPS');
    } catch (e) {
      const code = e instanceof Error ? e.message : 'DISCOVERY_FAILED';
      return {
        result: this.result(
          'failure',
          this.cancelled ? 'CANCELLED' : code,
          step,
          { observed: await this.safeEvidence() },
        ),
      };
    }
  }
  private async safeEvidence() {
    try {
      return await this.surface.evidence();
    } catch {
      return 'Surface unavailable or outside policy';
    }
  }
  async replay(
    rawArtifact: unknown,
    rawParams: unknown,
    options: {
      tenant?: 'northstar' | 'harbor';
      requireApproval?: boolean;
      recoveryModel?: Model;
    } = {},
  ): Promise<Result> {
    let step = 0;
    let outputs: Result['outputs'];
    let assistedUsed = false;
    try {
      const ap = ArtifactSchema.safeParse(rawArtifact);
      if (!ap.success) throw Error('INVALID_ARTIFACT');
      const artifact = ap.data;
      const pp = ParamsSchema.safeParse(rawParams);
      if (!pp.success) throw Error('INVALID_INPUT');
      const params = pp.data;
      if (options.requireApproval && artifact.approval.state !== 'approved')
        throw Error('APPROVAL_REQUIRED');
      if (!artifact.supported_versions.includes(this.surface.version()))
        throw Error('UNSUPPORTED_SURFACE_VERSION');
      this.context = {
        capability: { id: artifact.id, version: artifact.version },
      };
      this.log('replay.started', 0, {
        artifact: artifact.id,
        version: artifact.version,
        tenant: options.tenant || 'northstar',
        mode: options.recoveryModel ? 'assisted-opt-in' : 'deterministic',
      });
      const recoveries = new Map<string, number>();
      for (step = 0; step < artifact.steps.length; step++) {
        this.check();
        if (step >= this.policy.max_steps) throw Error('MAX_STEPS');
        const original = artifact.steps[step];
        const action = structuredClone(original);
        if (
          options.tenant === 'harbor' &&
          action.target.name === 'Search members'
        )
          action.target.name = 'Find member';
        let deadline = Date.now() + this.policy.timeout_ms;
        let handed = false;
        while (true) {
          this.check();
          for (const outcome of artifact.outcomes)
            if (await this.surface.has(outcome.text))
              return this.result('business_outcome', outcome.code, step);
          for (const recovery of artifact.recoveries) {
            if (await this.surface.has(recovery.text)) {
              const count = recoveries.get(recovery.text) || 0;
              if (
                count >=
                Math.min(recovery.max_attempts, this.policy.max_retries)
              )
                throw Error('RECOVERY_EXHAUSTED');
              await this.action(
                { action: 'click', target: recovery.target },
                params,
                step,
              );
              recoveries.set(recovery.text, count + 1);
              this.log('recovery.deterministic', step, {
                condition: recovery.text,
                attempt: count + 1,
              });
            }
          }
          try {
            outputs = (await this.action(action, params, step)) || outputs;
            break;
          } catch (e) {
            const reason = e instanceof Error ? e.message : 'ACTION_FAILED';
            if (
              reason.startsWith('POLICY') ||
              reason === 'AMBIGUOUS_TARGET' ||
              reason === 'OUTPUT_SHAPE_MISMATCH'
            )
              throw e;
            if (Date.now() < deadline) {
              await new Promise((r) => setTimeout(r, 100));
              continue;
            }
            // Exactly one recovery action, only from the explicit safe recovery control allowlist.
            if (options.recoveryModel && !assistedUsed) {
              assistedUsed = true;
              this.assisted = true;
              const obs = await this.surface.observe();
              const decision = DecisionSchema.parse(
                await this.decide(
                  options.recoveryModel,
                  'Recover this blocked session with one safe action. Do not perform the business operation.',
                  obs,
                  [],
                ),
              );
              const target = obs.controls.find(
                (c) => c.ref === decision.target,
              );
              if (
                decision.action !== 'click' ||
                !target ||
                !['Restore session', 'Dismiss notice', 'Retry load'].includes(
                  target.name,
                )
              )
                throw Error('ASSISTED_RECOVERY_DENIED');
              await this.action(
                {
                  action: 'click',
                  target: { kind: 'control', name: target.name },
                },
                params,
                step,
              );
              this.log('recovery.assisted', step, {
                model: options.recoveryModel.name,
                decision,
                original_step: step,
              });
              deadline = Date.now() + this.policy.timeout_ms;
              continue;
            }
            if (handed) throw Error('RESUME_STATE_INVALID');
            handed = true;
            await this.handoff(
              step,
              (await this.surface.has('Session expired'))
                ? 'SESSION_EXPIRED'
                : (await this.surface.has('Permission denied'))
                  ? 'PERMISSION_DENIED'
                  : reason,
            );
            deadline = Date.now() + this.policy.timeout_ms;
          }
        }
      }
      if (
        !outputs ||
        !(await this.surface.has(artifact.checkpoint.text)) ||
        (await this.surface.identity()) !== params.member_id
      )
        throw Error('CHECKPOINT_FAILED');
      this.log('checkpoint.verified', step, {
        text: artifact.checkpoint.text,
        identity: 'matched',
      });
      return this.result('success', 'OK', step, { outputs });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'REPLAY_FAILED';
      return this.result(
        'failure',
        code.includes('"issues"') ? 'INVALID_CONTRACT' : code,
        step,
        {
          expected:
            'Unique permitted target, declared checkpoint and matching member',
          observed: await this.safeEvidence(),
        },
      );
    }
  }
}
export function reuseLocalReview(supplied: unknown, local: Artifact): Artifact {
  const incoming = ArtifactSchema.parse(supplied);
  const contract = ({ approval: _approval, ...rest }: Artifact) =>
    JSON.stringify(rest);
  incoming.approval =
    contract(incoming) === contract(ArtifactSchema.parse(local))
      ? structuredClone(local.approval)
      : {
          state: 'draft',
          successful_replays: 0,
          failed_replays: 0,
          reviewer: null,
        };
  return incoming;
}
export function recordValidation(artifact: Artifact, result: Result): Artifact {
  const next = structuredClone(artifact);
  if (result.status === 'success' && !result.assisted)
    next.approval.successful_replays++;
  else if (result.status === 'failure') next.approval.failed_replays++;
  if (result.status === 'failure') next.approval.state = 'draft';
  return next;
}
export function approve(artifact: Artifact, reviewer: string): Artifact {
  if (
    artifact.approval.successful_replays < 3 ||
    artifact.approval.failed_replays > 0 ||
    !reviewer.trim()
  )
    throw Error(
      'Three successful deterministic replays and no unresolved failures required',
    );
  return {
    ...artifact,
    approval: { ...artifact.approval, state: 'approved', reviewer },
  };
}
export function exportAutomation(artifact: Artifact) {
  return `// Generated Relay capability invocation. Policy, waits, outcomes and checkpoint stay in the shared executor.\nimport { chromium } from '@playwright/test';\nimport { readFile } from 'node:fs/promises';\nconst artifact = ${JSON.stringify(artifact, null, 2)};\nconst browser = await chromium.launch({ headless: true });\nconst page = await browser.newPage();\ntry {\n await page.goto(process.env.RELAY_URL || 'http://localhost:3000/?app=1');\n await page.waitForFunction(() => !!window.relay);\n const result = await page.evaluate(async ({ artifact, member_id }) => window.relay.invoke(artifact, { member_id }), { artifact, member_id: process.env.MEMBER_ID || '67890' });\n console.log(JSON.stringify(result.result));\n if (result.result.status === 'failure') process.exitCode = 1;\n} finally { await browser.close(); }\n`;
}
