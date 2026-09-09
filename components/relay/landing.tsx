'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Play,
  Check,
  ChevronRight,
  Braces,
  MousePointer2,
  ScanLine,
  Fingerprint,
  CornerDownRight,
  Captions,
} from 'lucide-react';
import { exampleArtifact as example } from '@/core/example';

const source = 'https://github.com/Utsavd7/relay-computer-use';
const stages = [
  {
    label: 'Discover',
    icon: ScanLine,
    title: 'A model finds the path.',
    description:
      'Observe the screen. Choose a permitted action. Verify what changed.',
    foot: 'Local model · real UI observations',
  },
  {
    label: 'Record',
    icon: Braces,
    title: 'The workflow becomes a contract.',
    description:
      'Keep the actions, parameter bindings, and checkpoint in a versioned capability.',
    foot: 'Typed inputs · reviewable steps',
  },
  {
    label: 'Replay',
    icon: MousePointer2,
    title: 'Run it again. With control.',
    description:
      'Execute the saved steps for a new member, without calling the model.',
    foot: 'Deterministic execution · verified output',
  },
];
export default function Landing({ open }: { open: () => void }) {
  const [stage, setStage] = useState(0);
  const [captionsOn, setCaptionsOn] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tracks = video.current?.textTracks;
    if (!tracks) return;
    const syncCaptions = () =>
      setCaptionsOn(Array.from(tracks).some((track) => track.mode === 'showing'));
    tracks.addEventListener('change', syncCaptions);
    syncCaptions();
    return () => tracks.removeEventListener('change', syncCaptions);
  }, []);
  function toggleCaptions() {
    const tracks = video.current?.textTracks;
    if (!tracks?.length) return;
    const enabled = !Array.from(tracks).some((track) => track.mode === 'showing');
    for (const track of Array.from(tracks))
      track.mode = enabled ? 'showing' : 'disabled';
    setCaptionsOn(enabled);
  }
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('revealed');
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    root.current
      ?.querySelectorAll('[data-reveal]')
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="landing" ref={root}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="landing-nav">
        <a href="./" className="brand" aria-label="Relay home">
          <img src="favicon.svg" alt="" />
          relay
        </a>
        <nav aria-label="Main navigation">
          <a href="#how">The system</a>
          <a href="#demo">
            Walkthrough <span>01:45</span>
          </a>
          <a href={source} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={13} />
          </a>
        </nav>
        <button className="nav-launch" onClick={open}>
          Launch workbench <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="hero" id="main-content">
        <div className="hero-kicker">
          <span>
            <i className="status-dot" />
            Computer-use infrastructure
          </span>
          <span className="hero-edition">Discover / Record / Replay</span>
        </div>
        <div className="hero-heading">
          <h1>
            From one good run.
            <br />
            <em>To every next one.</em>
          </h1>
          <div className="hero-aside">
            <p>
              Give AI a way to act.
              <br />
              Give every action a way back.
            </p>
            <span>
              A local model learns a UI workflow. Relay turns it into a
              repeatable capability—with you in control.
            </span>
          </div>
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={open}>
            Open the workbench <ArrowUpRight size={18} />
          </button>
          <a href="#demo">
            <span className="play-circle">
              <Play size={12} fill="currentColor" />
            </span>
            Watch the 1:45 demo
          </a>
          <span className="hero-access">No sign-in. Runs in your browser.</span>
        </div>
        <div className="product-stage">
          <div className="stage-bar">
            <span>
              <img src="favicon.svg" alt="" />
              The execution loop
            </span>
            <span className="preview-tag">Recorded capability / preview</span>
          </div>
          <div
            className="stage-tabs"
            role="tablist"
            aria-label="Explore the execution loop"
          >
            {stages.map(({ label, icon: Icon }, i) => (
              <button
                key={label}
                id={`preview-tab-${i}`}
                role="tab"
                aria-selected={stage === i}
                tabIndex={stage === i ? 0 : -1}
                aria-controls={`preview-panel-${i}`}
                className={stage === i ? 'selected' : ''}
                onClick={() => setStage(i)}
                onKeyDown={(event) => {
                  if (
                    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 2
                        : (i + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
                  setStage(next);
                  document.getElementById(`preview-tab-${next}`)?.focus();
                }}
              >
                <span className="stage-index">0{i + 1}</span>
                <Icon size={16} />
                {label}
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
          <div
            className="stage-content"
            key={stage}
            id={`preview-panel-${stage}`}
            role="tabpanel"
            aria-labelledby={`preview-tab-${stage}`}
          >
            <div className="stage-brief">
              <span className="micro-label">
                0{stage + 1} / {stages[stage].label}
              </span>
              <h2>{stages[stage].title}</h2>
              <p>{stages[stage].description}</p>
              <div className="stage-foot">
                <i />
                {stages[stage].foot}
              </div>
            </div>
            <div className="capability-preview">
              <div className="preview-title">
                <span className="capability-glyph">
                  <Braces size={20} />
                </span>
                <div>
                  <strong>Savings balance</strong>
                  <small>
                    get_savings_balance <span>v{example.version}</span>
                  </small>
                </div>
                <span className="preview-version">
                  {stage === 0
                    ? 'LLM discovery'
                    : stage === 1
                      ? 'Saved artifact'
                      : 'Ready to replay'}
                </span>
              </div>
              <div className="preview-steps">
                {example.steps.map((step, i) => (
                  <div className="preview-step" key={i}>
                    <span className="step-tick">
                      <Check size={11} />
                    </span>
                    <span>{step.target.name}</span>
                    <code>{step.action}</code>
                  </div>
                ))}
              </div>
              <div className="preview-checkpoint">
                <Fingerprint size={16} />
                <span>
                  Checkpoint: <b>{example.checkpoint.text}</b>
                </span>
                <Check size={14} />
              </div>
            </div>
            <div className="stage-output">
              <span className="micro-label">The handover</span>
              <div className="parameter-block">
                <span>INPUT</span>
                <code>
                  member_id<span>: string</span>
                </code>
              </div>
              <div className="output-connector">
                <CornerDownRight size={25} />
                <span>
                  same steps,
                  <br />
                  new parameters
                </span>
              </div>
              <div className="parameter-block">
                <span>OUTPUT</span>
                <code>
                  balance<span>: number</span>
                </code>
                <code>
                  currency<span>: string</span>
                </code>
              </div>
              <button onClick={open}>
                Try a real run <ArrowUpRight size={15} />
              </button>
            </div>
          </div>
          <div className="stage-bottom">
            <span>
              <span className="status-dot" />
              Based on a real recorded discovery
            </span>
            <a
              href={`${source}/tree/main/evidence`}
              target="_blank"
              rel="noreferrer"
            >
              Inspect the evidence <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
        <div className="principles-strip">
          <span>Built for the UI layer.</span>
          <p>No target API</p>
          <p>Local inference</p>
          <p>Model-free replay</p>
          <p>Human handoff</p>
        </div>
      </div>
      <div className="landing-section" id="how" data-reveal>
        <div className="section-intro">
          <p className="eyebrow">THE SYSTEM, SIMPLIFIED</p>
          <h2>
            Intelligence where it helps.
            <br />
            <span>Control where it matters.</span>
          </h2>
          <p>
            Learning and execution have different jobs. Relay keeps their
            responsibilities clear.
          </p>
          <a
            className="text-link"
            href={`${source}/blob/main/REPORT.md`}
            target="_blank"
            rel="noreferrer"
          >
            Read the architecture <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="principle-list">
          {[
            [
              '01',
              'Learn from what’s actually there.',
              'The model observes the live screen and chooses from permitted actions. Every decision leaves evidence.',
            ],
            [
              '02',
              'Make a contract, not a guess.',
              'Typed inputs, precise targets, and a verified checkpoint turn a successful run into a reusable capability.',
            ],
            [
              '03',
              'Keep a human in the loop.',
              'When the unexpected happens, pause. Take over the same session, resolve the issue, and return control.',
            ],
          ].map(([n, title, body]) => (
            <div key={n}>
              <span>{n}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
              <ArrowUpRight size={17} />
            </div>
          ))}
        </div>
      </div>
      <div className="demo-section" id="demo" data-reveal>
        <div className="demo-heading">
          <div>
            <p className="eyebrow">A REAL RUN, START TO FINISH</p>
            <h2>
              Less explaining.
              <br />
              <span>More showing.</span>
            </h2>
          </div>
          <p>
            Watch discovery, replay, and a human handoff in one 1:45
            walkthrough.
          </p>
          <span className="demo-duration">
            01:45 <Play size={14} fill="currentColor" />
          </span>
        </div>
        <div className="video-shell">
          <video
            id="demo-video"
            ref={video}
            poster="demo-poster.jpg?v=sharp-4k"
            controls
            preload="metadata"
            playsInline
            aria-label="Relay 4K product walkthrough, one minute forty-five seconds"
          >
            <source src="demo.mp4?v=sharp-4k" type="video/mp4" />
            <track
              kind="captions"
              src="demo.vtt"
              srcLang="en"
              label="English"
            />
            Your browser does not support embedded video.
          </video>
        </div>
        <div className="demo-caption">
          <button
            type="button"
            className="subtitle-toggle"
            aria-controls="demo-video"
            aria-pressed={captionsOn}
            onClick={toggleCaptions}
          >
            <Captions size={17} />
            Subtitles <span>{captionsOn ? 'On' : 'Off'}</span>
          </button>
          <span>
            Recorded in the working product · Synthetic training records
          </span>
          <a href={`${source}/tree/main/evidence`}>
            View run evidence <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
      <div className="landing-cta" data-reveal>
        <div>
          <p className="eyebrow">YOUR TURN</p>
          <h2>
            A good run is
            <br />
            just the beginning.
          </h2>
        </div>
        <div>
          <button className="primary" onClick={open}>
            Enter the workbench <ArrowUpRight size={18} />
          </button>
          <p>
            Replay is ready now.
            <br />
            Discovery needs WebGPU and a local model download.
          </p>
        </div>
      </div>
      <div className="landing-footer">
        <a href="./" className="brand">
          <img src="favicon.svg" alt="" />
          relay
        </a>
        <p>
          Computer-use, with a memory.
          <span>Open source. Local first. Human controlled.</span>
        </p>
        <a href={source} target="_blank" rel="noreferrer">
          Explore the source <ArrowUpRight size={14} />
        </a>
      </div>
    </div>
  );
}
