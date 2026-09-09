'use client';
import { useState, useRef, useEffect } from 'react';
import {
  Workflow,
  Play,
  ShieldCheck,
  Activity,
  Layers,
  Command,
  ArrowUpRight,
  Download,
  Check,
  Square,
  Hand,
  RefreshCw,
  Code,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  GitFork,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Runner,
  approve,
  recordValidation,
  exportAutomation,
  catalogDescription,
  type Intervention,
} from '@/core/engine';
import { BrowserSurface } from '@/core/surface';
import {
  ArtifactSchema,
  defaultPolicy,
  type Artifact,
  type Event,
  type Result,
  type Model,
  type Params,
} from '@/core/schema';
import { exampleArtifact } from '@/core/example';
import { browserModel } from '@/core/models';
import { redact } from '@/core/privacy';
const download = (filename: string, value: unknown) => {
  const blob = new Blob(
    [typeof value === 'string' ? value : JSON.stringify(value, null, 2)],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const pause = (n: number) => new Promise((r) => setTimeout(r, n));
function eventSummary(event: Event) {
  const d = event.detail as any;
  if (event.type === 'observation')
    return `${d.controls?.length || 0} controls observed on the current screen`;
  if (d.reason) return d.reason;
  if (d.target) return `${d.action || 'Action'} · ${d.target.name || d.target}`;
  if (d.code) return d.code;
  if (d.text) return d.text;
  if (d.owner) return `Control: ${d.owner}`;
  if (d.model) return d.model;
  if (d.steps) return `${d.steps} recorded steps`;
  return JSON.stringify(d);
}
export default function Workbench() {
  const [view, setView] = useState('workbench'),
    [mode, setMode] = useState('replay'),
    [member, setMember] = useState('12345'),
    [tenant, setTenant] = useState<'northstar' | 'harbor'>('northstar'),
    [scenario, setScenario] = useState('normal'),
    [goal, setGoal] = useState(
      'Look up this member and read their current savings balance.',
    ),
    [artifact, setArtifact] = useState<Artifact>(exampleArtifact),
    [events, setEvents] = useState<Event[]>([]),
    [result, setResult] = useState<Result | null>(null),
    [busy, setBusy] = useState(false),
    [intervention, setIntervention] = useState<Intervention | null>(null),
    [notice, setNotice] = useState(''),
    [modelStatus, setModelStatus] = useState('Model not loaded'),
    [stability, setStability] = useState<Result[]>([]),
    [strict, setStrict] = useState(false),
    [assisted, setAssisted] = useState(false),
    [policyText, setPolicyText] = useState(
      JSON.stringify(defaultPolicy, null, 2),
    );
  const frame = useRef<HTMLIFrameElement>(null),
    runner = useRef<Runner | null>(null),
    model = useRef<Model | null>(null),
    lock = useRef(false),
    latest = useRef<{
      result: Result | null;
      events: Event[];
      artifact: Artifact;
    }>({ result: null, events: [], artifact }),
    artifactRef = useRef(artifact);
  artifactRef.current = artifact;
  latest.current = { result, events, artifact };
  useEffect(() => {
    try {
      const saved = localStorage.getItem('relay.capability.v1');
      if (saved) setArtifact(ArtifactSchema.parse(JSON.parse(saved)));
    } catch {
      setNotice('Saved capability was invalid. Loaded the reviewed example.');
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('relay.capability.v1', JSON.stringify(artifact));
    } catch {
      setNotice(
        'Device storage is unavailable. Export your capability to keep it.',
      );
    }
  }, [artifact]);
  async function reset(s = scenario, t = tenant) {
    const f = frame.current;
    if (!f) throw Error('SESSION_UNAVAILABLE');
    f.src = `bank.html?tenant=${encodeURIComponent(t)}&scenario=${encodeURIComponent(s)}&session=${Date.now()}`;
    for (let i = 0; i < 100; i++) {
      await pause(60);
      const inner = f.contentDocument?.querySelector('iframe')?.contentDocument;
      if (
        inner?.querySelector('input') &&
        inner.URL.includes(`scenario=${encodeURIComponent(s)}`)
      )
        return;
    }
    throw Error('SESSION_LOAD_TIMEOUT');
  }
  async function getModel(): Promise<Model> {
    if ((window as any).relayModel) {
      setModelStatus('Local model connected');
      return {
        name: (window as any).relayModelName || 'local-model',
        decide: (g, o, h) => (window as any).relayModel(g, o, h),
      };
    }
    if (!model.current) {
      setModelStatus('Downloading model weights…');
      model.current = await browserModel(setModelStatus);
      setModelStatus('Qwen 3 · Ready on device');
    }
    return model.current;
  }
  async function run(
    kind = 'replay',
    suppliedArtifact: Artifact = artifactRef.current,
    params: Params = { member_id: member },
    opts: {
      scenario?: string;
      tenant?: 'northstar' | 'harbor';
      requireApproval?: boolean;
      assisted?: boolean;
      goal?: string;
      noHuman?: boolean;
    } = {},
  ) {
    if (lock.current) throw Error('SESSION_BUSY');
    lock.current = true;
    setView('workbench');
    setBusy(true);
    setEvents([]);
    setResult(null);
    setIntervention(null);
    setNotice('');
    try {
      await reset(opts.scenario || scenario, opts.tenant || tenant);
      const policy = JSON.parse(policyText);
      if (
        !Array.isArray(policy.routes) ||
        !Array.isArray(policy.actions) ||
        !Number.isFinite(policy.timeout_ms) ||
        policy.timeout_ms < 100 ||
        policy.timeout_ms > 30000 ||
        policy.max_steps < 1 ||
        policy.max_steps > 50 ||
        policy.max_retries < 0 ||
        policy.max_retries > 2
      )
        throw Error('INVALID_POLICY');
      const surface = new BrowserSurface(
        () => frame.current!.contentDocument!,
        policy,
      );
      const r = new Runner(
        surface,
        policy,
        (e) => setEvents((old) => [...old, e]),
        opts.noHuman ? undefined : setIntervention,
      );
      runner.current = r;
      let outcome: Result;
      let next = suppliedArtifact;
      if (kind === 'discover') {
        const discovery = await r.discover(
          opts.goal || goal,
          params,
          await getModel(),
        );
        outcome = discovery.result;
        if (discovery.artifact) next = discovery.artifact;
      } else {
        outcome = await r.replay(suppliedArtifact, params, {
          tenant: opts.tenant || tenant,
          requireApproval: opts.requireApproval ?? strict,
          recoveryModel:
            (opts.assisted ?? assisted) ? await getModel() : undefined,
        });
        next = recordValidation(suppliedArtifact, outcome);
      }
      setArtifact(next);
      artifactRef.current = next;
      setResult(outcome);
      latest.current = { result: outcome, events: r.events, artifact: next };
      return { result: outcome, artifact: next, events: r.events };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Run failed';
      setNotice(message);
      throw e;
    } finally {
      setBusy(false);
      setIntervention(null);
      lock.current = false;
    }
  }
  async function stabilityRun() {
    setStability([]);
    const results: Result[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        const r = await run(
          'replay',
          artifactRef.current,
          { member_id: i % 2 ? '67890' : '12345' },
          { scenario: 'normal', assisted: false },
        );
        results.push(r.result);
        setStability([...results]);
      }
    } catch (e) {
      setNotice(String(e));
    }
  }
  function resume() {
    runner.current?.resume();
    setIntervention(null);
  }
  useEffect(() => {
    const api = {
      catalog: () => [catalogDescription],
      invoke: async (a: Artifact, p: Params, options: any = {}) =>
        run('replay', a, p, options),
      discover: async (p: Params, options: any = {}) =>
        run('discover', artifactRef.current, p, options),
      snapshot: () => latest.current,
      resume,
      cancel: () => runner.current?.cancel(),
      reset,
    };
    (window as any).relay = api;
    const context = (document as any).modelContext;
    const lifecycle = new AbortController();
    if (context?.registerTool) {
      for (const tool of [
        {
          name: 'relay_list_capabilities',
          description: 'List available UI capabilities.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: () => api.catalog(),
        },
        {
          name: 'relay_replay_balance',
          description:
            'Execute the saved balance capability in the live synthetic banking UI.',
          inputSchema: catalogDescription.inputSchema,
          annotations: { readOnlyHint: false },
          execute: (p: Params) => api.invoke(artifactRef.current, p),
        },
      ]) {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      }
    }
    return () => lifecycle.abort();
  });
  const nav = [
    ['workbench', 'Workbench', Command],
    ['capabilities', 'Capabilities', Layers],
    ['evidence', 'Evidence', Activity],
    ['policy', 'Policy', ShieldCheck],
  ] as const;
  return (
    <div className="workspace">
      <aside>
        <a href="./" className="brand">
          <img src="favicon.svg" alt="" />
          relay<span>.</span>
        </a>
        <small>AUTOMATION WORKSPACE</small>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={view === id ? 'active' : ''}
              onClick={() => setView(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>
        <div className="rail-note">
          <ShieldCheck size={17} />
          <p>
            Bounded actions.
            <br />
            Accountable execution.
          </p>
        </div>
        <div className="author">
          RELAY WORKSPACE
          <br />
          <small>Computer-use automation</small>
        </div>
      </aside>
      <main>
        <header>
          <span>
            Workspace <span className="breadcrumb">/</span>{' '}
            {nav.find((n) => n[0] === view)?.[1]}
          </span>
          <span>
            <i className="status-dot" />
            {busy
              ? intervention
                ? 'Human in control'
                : 'Automation running'
              : 'Local-first workspace'}
          </span>
        </header>
        <article>
          <div className="title-row">
            <div>
              <p className="eyebrow">COMPUTER-USE AUTOMATION</p>
              <h1>
                {view === 'workbench'
                  ? 'Teach once. Run reliably.'
                  : view === 'capabilities'
                    ? 'A workflow. A clear contract.'
                    : view === 'evidence'
                      ? 'Every action leaves evidence.'
                      : 'Permission before execution.'}
              </h1>
              <p className="muted">
                {view === 'workbench'
                  ? 'Turn a real UI workflow into a capability you can trust.'
                  : view === 'capabilities'
                    ? 'Inspect, validate and approve reusable UI capabilities.'
                    : view === 'evidence'
                      ? 'Redacted run records and verified outcomes.'
                      : 'Rules apply to discovery, replay and assisted recovery.'}
              </p>
            </div>
            <a
              className="source-link"
              href="https://github.com/Utsavd7/relay-computer-use"
              target="_blank"
              rel="noreferrer"
            >
              <GitFork size={16} />
              Source
              <ArrowUpRight size={14} />
            </a>
          </div>
          {notice && (
            <div className="notice" role="alert">
              <AlertTriangle size={17} />
              {notice}
            </div>
          )}
          <div className="metrics">
            <div>
              <small>CAPABILITY</small>
              <b>
                {artifact.name}{' '}
                <span className="version">v{artifact.version}</span>
              </b>
            </div>
            <div>
              <small>REPLAY VALIDATION</small>
              <b>
                {artifact.approval.successful_replays} passed{' '}
                <span className="light">
                  / {artifact.approval.failed_replays} failed
                </span>
              </b>
            </div>
            <div>
              <small>REVIEW STATUS</small>
              <b
                className={
                  artifact.approval.state === 'approved' ? 'green' : ''
                }
              >
                {artifact.approval.state === 'approved'
                  ? 'Approved for replay'
                  : 'Draft · review required'}
              </b>
            </div>
          </div>
          <div style={{ display: view === 'workbench' ? 'block' : 'none' }}>
            <section>
              <Tabs value={mode} onValueChange={(v) => setMode(String(v))}>
                <div className="run-heading">
                  <TabsList>
                    <TabsTrigger value="replay">Replay</TabsTrigger>
                    <TabsTrigger value="discover">Discover</TabsTrigger>
                  </TabsList>
                  <span className="pill">
                    {mode === 'replay'
                      ? 'No model decisions'
                      : 'Local language model'}
                  </span>
                </div>
                <TabsContent value="discover">
                  <div className="goal-field">
                    <label htmlFor="goal">
                      Goal
                      <Textarea
                        id="goal"
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        disabled={busy}
                      />
                    </label>
                    <p>
                      {modelStatus}. First use downloads approximately 2–3 GB;
                      WebGPU is required. Model access stays on your device.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              <div className="form">
                <label htmlFor="member">
                  Member ID
                  <Input
                    id="member"
                    value={member}
                    onChange={(e) => setMember(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <label htmlFor="tenant">
                  Institution
                  <select
                    aria-label="Institution"
                    id="tenant"
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value as any)}
                    disabled={busy}
                  >
                    <option value="northstar">Northstar Credit Union</option>
                    <option value="harbor">Harbor Community Bank</option>
                  </select>
                </label>
                <label htmlFor="scenario">
                  Runtime condition
                  <select
                    aria-label="Runtime condition"
                    id="scenario"
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    disabled={busy}
                  >
                    <option value="normal">Normal operation</option>
                    <option value="slow">Slow response</option>
                    <option value="transient">Transient failure</option>
                    <option value="dialog">Known notice</option>
                    <option value="handoff">Session expiry → human</option>
                    <option value="recovery">Session expiry → assisted</option>
                    <option value="permission">Permission denied</option>
                    <option value="unknown">Unknown error</option>
                  </select>
                </label>
                <Button
                  className="primary"
                  disabled={busy}
                  onClick={() => run(mode).catch(() => {})}
                >
                  {busy ? (
                    <RefreshCw className="spin" size={15} />
                  ) : (
                    <Play size={15} />
                  )}{' '}
                  {mode === 'replay'
                    ? 'Replay capability'
                    : 'Discover workflow'}
                </Button>
              </div>
              <div className="options-row">
                <label>
                  <input
                    type="checkbox"
                    checked={strict}
                    onChange={(e) => setStrict(e.target.checked)}
                    disabled={busy}
                  />
                  Require approval
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={assisted}
                    onChange={(e) => setAssisted(e.target.checked)}
                    disabled={busy}
                  />
                  Allow one model recovery
                </label>
                <span>Synthetic members: 12345, 67890, 24680</span>
              </div>
            </section>
            {intervention && (
              <div className="intervention" role="alert">
                <Hand size={25} />
                <div>
                  <strong>Your session needs a hand.</strong>
                  <p>
                    {intervention.reason} · Step {intervention.step + 1}.
                    Operate the live session below, then return control.
                  </p>
                </div>
                <Button className="primary" onClick={resume}>
                  Return control
                </Button>
                <Button
                  variant="outline"
                  onClick={() => runner.current?.cancel()}
                >
                  Abort
                </Button>
              </div>
            )}
            {result && (
              <div className={`result ${result.status}`} role="status">
                <CheckCircle2 size={22} />
                <div>
                  <strong>
                    {result.status === 'success'
                      ? 'Checkpoint verified'
                      : result.status === 'business_outcome'
                        ? 'Known business outcome'
                        : 'Run stopped safely'}
                  </strong>
                  <p>
                    {result.status === 'success'
                      ? `${result.outputs?.currency} ${result.outputs?.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} · Savings balance`
                      : result.code}
                  </p>
                </div>
                <span>
                  {result.model_calls} model calls
                  {result.assisted ? ' · assisted' : ''}
                </span>
              </div>
            )}
          </div>
          <div
            className="grid"
            style={{ display: view === 'workbench' ? 'grid' : 'none' }}
          >
            <section>
              <h2>
                Live session{' '}
                <span>
                  {intervention
                    ? 'HUMAN CONTROL'
                    : busy
                      ? 'AUTOMATION'
                      : 'READY'}
                </span>
              </h2>
              <div className="session-toolbar">
                <i />
                <i />
                <i />
                <span>relay-core / {tenant} / live session</span>
                {busy && (
                  <button
                    aria-label="Stop run"
                    onClick={() => runner.current?.cancel()}
                  >
                    <Square size={13} />
                  </button>
                )}
              </div>
              <div className="frame-wrap">
                <iframe
                  ref={frame}
                  title="Live banking session"
                  src="bank.html?scenario=normal&tenant=northstar"
                />
                <div
                  className="frame-shield"
                  hidden={!!intervention}
                  aria-hidden="true"
                />
              </div>
              <div className="session-footer">
                <ShieldCheck size={13} />
                Isolated training surface · No real financial data
              </div>
            </section>
            <section>
              <h2>
                Execution timeline <span>{events.length} events</span>
              </h2>
              <div className="timeline" aria-live="polite">
                {events.length ? (
                  events
                    .filter((e) => e.type !== 'action.start')
                    .map((e, i) => (
                      <div className="event" key={i}>
                        <span
                          className={`event-dot ${e.type.includes('human') ? 'amber' : ''}`}
                        />
                        <div>
                          <b>{e.type.replaceAll('.', ' / ')}</b>
                          <p>{eventSummary(e)}</p>
                        </div>
                        <time>
                          {new Date(e.time).toLocaleTimeString('en-GB')}
                        </time>
                      </div>
                    ))
                ) : (
                  <div className="empty">
                    <Activity />
                    <h3>Your next run starts here.</h3>
                    <p>
                      Actions, checkpoints and intervention requests appear as
                      the session runs.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
          {view === 'capabilities' && (
            <>
              <section>
                <h2>
                  {artifact.id}
                  <span>{artifact.provenance.kind}</span>
                </h2>
                <div className="capability-body">
                  <p>{artifact.description}</p>
                  <div className="contract">
                    <div>
                      <small>INPUT</small>
                      <code>member_id: string</code>
                    </div>
                    <ChevronRight />
                    <div>
                      <small>OUTPUT</small>
                      <code>
                        balance: number
                        <br />
                        currency: string
                      </code>
                    </div>
                  </div>
                  <div className="steps">
                    {artifact.steps.map((step, i) => (
                      <div key={i}>
                        <span>{String(i + 1).padStart(2, '0')}</span>
                        <b>{step.action}</b>
                        <p>{step.target.name}</p>
                        <code>{'input' in step ? '← member_id' : ''}</code>
                      </div>
                    ))}
                  </div>
                  <div className="button-row">
                    <Button
                      variant="outline"
                      onClick={() => download('capability.json', artifact)}
                    >
                      <Download />
                      Artifact
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        download(
                          'relay-automation.mjs',
                          exportAutomation(artifact),
                        )
                      }
                    >
                      <Code />
                      Export runnable code
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={stabilityRun}
                    >
                      <Activity />
                      Validate 5 replays
                    </Button>
                    <Button
                      className="primary"
                      disabled={busy}
                      onClick={() => {
                        try {
                          setArtifact(approve(artifact, 'Local operator'));
                          setNotice('Capability approved on this device.');
                        } catch (e) {
                          setNotice((e as Error).message);
                        }
                      }}
                    >
                      <Check />
                      Approve capability
                    </Button>
                  </div>
                  {stability.length > 0 && (
                    <p className="validation-note">
                      Stability:{' '}
                      {stability.filter((r) => r.status === 'success').length}/
                      {stability.length} passed ·{' '}
                      {Math.round(
                        (stability.filter((r) => r.status === 'success')
                          .length /
                          stability.length) *
                          100,
                      )}
                      % observed success. Small sample, not a reliability
                      guarantee.
                    </p>
                  )}
                  <details>
                    <summary>Inspect full schema and provenance</summary>
                    <pre>{JSON.stringify(artifact, null, 2)}</pre>
                  </details>
                  <label className="import-label">
                    Import capability
                    <input
                      type="file"
                      accept="application/json,.json"
                      onChange={async (e) => {
                        try {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (f.size > 100000) throw Error('File too large');
                            setArtifact(
                              ArtifactSchema.parse(JSON.parse(await f.text())),
                            );
                            setNotice(
                              'Capability imported as supplied; review provenance before approval.',
                            );
                          }
                        } catch (err) {
                          setNotice((err as Error).message);
                        }
                      }}
                    />
                  </label>
                </div>
              </section>
            </>
          )}
          {view === 'evidence' && (
            <section>
              <h2>
                Run evidence <span>Redacted at capture</span>
              </h2>
              <div className="capability-body">
                <p>
                  Export the current run, or inspect the genuine discovery and
                  replay evidence committed with this submission.
                </p>
                <div className="button-row">
                  <Button
                    variant="outline"
                    disabled={!events.length}
                    onClick={() =>
                      download('run-evidence.json', redact({ result, events }))
                    }
                  >
                    <Download />
                    Export current run
                  </Button>
                  <a
                    className="text-link"
                    href="https://github.com/Utsavd7/relay-computer-use/tree/main/evidence"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open recorded evidence <ArrowUpRight size={14} />
                  </a>
                </div>
                <pre>
                  {events.length
                    ? JSON.stringify(redact({ result, events }), null, 2)
                    : 'Run a capability to capture evidence in this session.'}
                </pre>
              </div>
            </section>
          )}
          {view === 'policy' && (
            <section>
              <h2>
                Execution policy <span>Applies to next run</span>
              </h2>
              <div className="capability-body">
                <div className="policy-list">
                  <div>
                    <ShieldCheck />
                    <b>Explicit allowlist</b>
                    <p>Only permitted routes and action types may execute.</p>
                  </div>
                  <div>
                    <Hand />
                    <b>Risky actions blocked</b>
                    <p>
                      Transfers and destructive controls are rejected before a
                      click.
                    </p>
                  </div>
                  <div>
                    <BookOpen />
                    <b>Redacted persistence</b>
                    <p>
                      Member identifiers, credentials and balance values stay
                      out of saved evidence.
                    </p>
                  </div>
                </div>
                <label>
                  Configurable policy
                  <Textarea
                    rows={13}
                    className="code-input"
                    value={policyText}
                    onChange={(e) => setPolicyText(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <p className="muted">
                  This local sandbox has no multi-user authorization. Approvals
                  are device-local review markers, not a production trust
                  boundary. See REPORT.md for limitations.
                </p>
              </div>
            </section>
          )}
          <footer>
            RELAY / COMPUTER-USE AUTOMATION
            <span>Discover · Record · Replay</span>
          </footer>
        </article>
      </main>
    </div>
  );
}
