import test from 'node:test';
import assert from 'node:assert/strict';
import { Runner, approve, recordValidation } from '../core/engine';
import { exampleArtifact } from '../core/example';
import {
  ArtifactSchema,
  defaultPolicy,
  type Action,
  type Params,
  type Surface,
  type Observation,
} from '../core/schema';
import { redact } from '../core/privacy';
class FakeSurface implements Surface {
  actions: Action[] = [];
  state = '';
  id = '67890';
  fail = false;
  version() {
    return '1.0';
  }
  route() {
    return '/bank.html';
  }
  async observe(): Promise<Observation> {
    return { text: this.state, controls: [] };
  }
  async evidence() {
    return JSON.stringify({ state: this.state });
  }
  async has(s: string) {
    return this.state.includes(s);
  }
  async identity() {
    return this.id;
  }
  async act(a: Action, _p: Params) {
    if (this.fail) throw Error('TARGET_NOT_FOUND');
    this.actions.push(a);
    if (a.action === 'read') {
      this.state = 'Account overview';
      return { balance: 100, currency: 'USD' };
    }
  }
}
const policy = { ...defaultPolicy, timeout_ms: 1 };
test('replay validates identity and output with no model calls', async () => {
  const r = await new Runner(new FakeSurface(), policy).replay(
    exampleArtifact,
    { member_id: '67890' },
  );
  assert.equal(r.status, 'success');
  assert.equal(r.model_calls, 0);
  assert.equal(r.outputs?.balance, 100);
});
test('not found is a business outcome, not a crash', async () => {
  const s = new FakeSurface();
  s.state = 'Member not found';
  const r = await new Runner(s, policy).replay(exampleArtifact, {
    member_id: '99999',
  });
  assert.equal(r.status, 'business_outcome');
  assert.equal(r.code, 'MEMBER_NOT_FOUND');
  assert.equal(s.actions.length, 0);
});
test('checkpoint rejects the wrong member', async () => {
  const s = new FakeSurface();
  s.id = '12345';
  const r = await new Runner(s, policy).replay(exampleArtifact, {
    member_id: '67890',
  });
  assert.equal(r.code, 'CHECKPOINT_FAILED');
});
test('invalid parameters cannot cause actions', async () => {
  const s = new FakeSurface();
  const r = await new Runner(s, policy).replay(exampleArtifact, {
    member_id: 'bad',
  });
  assert.equal(r.status, 'failure');
  assert.equal(s.actions.length, 0);
});
test('approval gates unattended invocation before actions', async () => {
  const s = new FakeSurface();
  const r = await new Runner(s, policy).replay(
    exampleArtifact,
    { member_id: '67890' },
    { requireApproval: true },
  );
  assert.equal(r.code, 'APPROVAL_REQUIRED');
  assert.equal(s.actions.length, 0);
});
test('unknown artifact actions cannot execute', () => {
  assert.throws(() =>
    ArtifactSchema.parse({
      ...exampleArtifact,
      steps: [{ action: 'eval', source: 'anything' }],
    }),
  );
});
test('failure includes expected and observed state', async () => {
  const s = new FakeSurface();
  s.fail = true;
  const r = await new Runner(s, policy).replay(exampleArtifact, {
    member_id: '67890',
  });
  assert.equal(r.status, 'failure');
  assert.ok(r.expected);
  assert.ok(r.observed);
});
test('human handoff pauses, resumes and retains the same surface', async () => {
  const s = new FakeSurface();
  s.fail = true;
  let requested = false;
  const runner = new Runner(s, policy, undefined, () => {
    requested = true;
    assert.equal(runner.owner, 'human');
    s.fail = false;
    runner.resume();
  });
  const r = await runner.replay(exampleArtifact, { member_id: '67890' });
  assert.ok(requested);
  assert.equal(r.status, 'success');
  assert.ok(runner.events.some((e) => e.type === 'control.transferred'));
});
test('cancel ends a human-owned run', async () => {
  const s = new FakeSurface();
  s.fail = true;
  const runner = new Runner(s, policy, undefined, () => runner.cancel());
  const r = await runner.replay(exampleArtifact, { member_id: '67890' });
  assert.equal(r.code, 'CANCELLED');
});
test('approval requires three unassisted successes', () => {
  let a = structuredClone(exampleArtifact);
  const result = {
    status: 'success',
    code: 'OK',
    step: 5,
    model_calls: 0,
    assisted: false,
    run_id: 'test',
  } as const;
  assert.throws(() => approve(a, 'Operator'));
  for (let i = 0; i < 3; i++) a = recordValidation(a, result);
  assert.equal(approve(a, 'Operator').approval.state, 'approved');
  a = recordValidation(a, { ...result, status: 'failure' });
  assert.equal(a.approval.state, 'draft');
  assert.throws(() => approve(a, 'Operator'));
});
test('redaction strips identifiers, outputs, tokens, and emails recursively', () => {
  const r = JSON.stringify(
    redact({
      member_id: '12345',
      balance: 42,
      nested: {
        message: 'member 67890 USD 4,280.50 user@example.com Bearer xyz',
        token: 'secret',
      },
    }),
  );
  for (const value of [
    '12345',
    '67890',
    '4,280.50',
    'user@example.com',
    'xyz',
    'secret',
  ])
    assert.ok(!r.includes(value));
  assert.ok(r.includes('[REDACTED]'));
});
test('assisted recovery is bounded and explicitly classified', async () => {
  const s = new FakeSurface();
  s.fail = true;
  s.observe = async () => ({
    text: 'Session expired',
    controls: [{ ref: 0, name: 'Restore session', kind: 'control' as const }],
  });
  const original = s.act.bind(s);
  s.act = async (a, p) => {
    if (a.target.name === 'Restore session') {
      s.fail = false;
      return;
    }
    return original(a, p);
  };
  let calls = 0;
  const model = {
    name: 'test-model',
    decide: async () => {
      calls++;
      return { action: 'click', target: 0, reason: 'Restore session' };
    },
  };
  const r = await new Runner(s, policy).replay(
    exampleArtifact,
    { member_id: '67890' },
    { recoveryModel: model },
  );
  assert.equal(r.status, 'success');
  assert.equal(calls, 1);
  assert.equal(r.assisted, true);
  assert.equal(r.model_calls, 1);
});
test('unsafe assisted action is rejected', async () => {
  const s = new FakeSurface();
  s.fail = true;
  s.observe = async () => ({
    text: 'Blocked',
    controls: [{ ref: 0, name: 'Submit transfer', kind: 'control' as const }],
  });
  const r = await new Runner(s, policy).replay(
    exampleArtifact,
    { member_id: '67890' },
    {
      recoveryModel: {
        name: 'test',
        decide: async () => ({ action: 'click', target: 0, reason: 'unsafe' }),
      },
    },
  );
  assert.equal(r.code, 'ASSISTED_RECOVERY_DENIED');
});
test('discovery re-observes and continues after a real ownership handback', async () => {
  const s = new FakeSurface();
  s.observe = async () => ({
    text: s.state,
    controls: [
      { ref: 0, name: 'Member ID', kind: 'field' as const },
      { ref: 1, name: 'Savings balance', kind: 'text' as const },
    ],
  });
  let calls = 0,
    handed = false;
  const runner = new Runner(s, policy, undefined, (request) => {
    handed = true;
    assert.ok(request.context.goal);
    runner.resume();
  });
  const model = {
    name: 'test-only-model',
    decide: async () => {
      calls++;
      if (calls <= 2) throw Error('model unavailable');
      return calls === 3
        ? {
            action: 'fill',
            target: 0,
            input: 'member_id',
            reason: 'Enter parameter',
          }
        : { action: 'read', target: 1, reason: 'Read visible balance' };
    },
  };
  const discovery = await runner.discover(
    'Read the savings balance',
    { member_id: '67890' },
    model,
  );
  assert.equal(handed, true);
  assert.equal(discovery.result.status, 'success');
  assert.equal(discovery.artifact?.steps.length, 2);
  assert.equal(discovery.result.model_calls, 4);
});

test('an unsupported business goal cannot be reported as balance success', async () => {
  let calls = 0;
  const result = await new Runner(new FakeSurface(), policy).discover(
    'Submit a transfer',
    { member_id: '67890' },
    {
      name: 'test',
      decide: async () => {
        calls++;
        return {};
      },
    },
  );
  assert.equal(result.result.code, 'UNSUPPORTED_GOAL');
  assert.equal(calls, 0);
});

test('malformed policies cannot disable execution limits', async () => {
  const { PolicySchema } = await import('../core/schema');
  for (const patch of [
    { max_steps: '50' },
    { max_steps: 1.5 },
    { max_retries: -1 },
    { timeout_ms: Infinity },
    { actions: ['eval'] },
    { routes: ['/evil/bank.html'] },
    { risky: 'allow' },
    { model_timeout_ms: 0 },
  ])
    assert.equal(
      PolicySchema.safeParse({ ...defaultPolicy, ...patch }).success,
      false,
    );
});
test('imported approval and fabricated validation history are discarded', async () => {
  const { importArtifact } = await import('../core/schema');
  const supplied = structuredClone(exampleArtifact);
  supplied.approval = {
    state: 'approved',
    successful_replays: 999,
    failed_replays: 0,
    reviewer: 'Forged',
  };
  const imported = importArtifact(supplied);
  assert.equal(imported.approval.state, 'draft');
  assert.equal(imported.approval.successful_replays, 0);
  assert.equal(supplied.approval.state, 'approved');
});
test('caller review metadata cannot promote or alter the locally reviewed contract', async () => {
  const { reuseLocalReview } = await import('../core/engine');
  const forged = structuredClone(exampleArtifact);
  forged.approval = {
    state: 'approved',
    successful_replays: 999,
    failed_replays: 0,
    reviewer: 'Forged',
  };
  assert.equal(
    reuseLocalReview(forged, exampleArtifact).approval.state,
    'draft',
  );
  const changed = structuredClone(forged);
  changed.description = 'Changed contract';
  assert.equal(reuseLocalReview(changed, forged).approval.state, 'draft');
});
test('empty business outcome matchers are rejected', () => {
  assert.equal(
    ArtifactSchema.safeParse({
      ...exampleArtifact,
      outcomes: [{ text: '', code: 'FAKE_SUCCESS' }],
    }).success,
    false,
  );
});
test('assisted model timeout is bounded and causes no recovery action', async () => {
  const surface = new FakeSurface();
  surface.fail = true;
  const result = await new Runner(surface, {
    ...policy,
    model_timeout_ms: 15,
  }).replay(
    exampleArtifact,
    { member_id: '67890' },
    {
      recoveryModel: {
        name: 'never-returns',
        decide: () => new Promise(() => {}),
      },
    },
  );
  assert.equal(result.code, 'MODEL_TIMEOUT');
  assert.equal(result.model_calls, 1);
  assert.equal(surface.actions.length, 0);
});
test('cancelling in-flight inference releases the run and ignores late decisions', async () => {
  const surface = new FakeSurface();
  const runner = new Runner(surface, policy);
  let finish: (value: unknown) => void = () => {};
  const run = runner.discover(
    'Read savings balance',
    { member_id: '67890' },
    {
      name: 'slow-model',
      decide: () =>
        new Promise((resolve) => {
          finish = resolve;
          setTimeout(() => runner.cancel(), 5);
        }),
    },
  );
  assert.equal((await run).result.code, 'CANCELLED');
  finish({ action: 'fill', target: 0, reason: 'late' });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(surface.actions.length, 0);
});
test('model boundary redacts secrets supplied in the goal and observation', async () => {
  const surface = new FakeSurface();
  surface.observe = async () => ({
    text: 'api_key=example-secret',
    controls: [],
  });
  const runner = new Runner(surface, policy);
  let prompt = '';
  await runner.discover(
    'Read balance for 12345 password=hunter-example',
    { member_id: '67890' },
    {
      name: 'inspection-model',
      decide: async (goal, observation) => {
        prompt = goal + observation.text;
        runner.cancel();
        return {};
      },
    },
  );
  for (const secret of ['12345', 'hunter-example', 'example-secret'])
    assert.ok(!prompt.includes(secret));
});
test('redaction masks additional credential formats', () => {
  const text = JSON.stringify(
    redact({
      refresh_token: 'refresh-value',
      apiKey: 'api-value',
      cookie: 'session-value',
      message: 'password=pass-value Basic abcdef https://user:pw@example.com',
    }),
  );
  for (const secret of [
    'refresh-value',
    'api-value',
    'session-value',
    'pass-value',
    'abcdef',
    'user:pw',
  ])
    assert.ok(!text.includes(secret));
});
