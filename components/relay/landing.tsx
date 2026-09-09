'use client';
import {
  Workflow,
  ArrowUpRight,
  ArrowRight,
  Play,
  ShieldCheck,
  Hand,
  Braces,
  GitBranch,
  CheckCircle2,
  GitFork,
} from 'lucide-react';
export default function Landing({ open }: { open: () => void }) {
  return (
    <div className="landing">
      <div className="landing-orbit" />
      <div className="landing-nav">
        <a href="./" className="brand">
          <img src="favicon.svg" alt="" />
          relay<span>.</span>
        </a>
        <div>
          <a href="#how">How it works</a>
          <a href="#demo">Watch demo</a>
          <a
            href="https://github.com/Utsavd7/relay-computer-use"
            target="_blank"
            rel="noreferrer"
          >
            <GitFork size={16} />
            Source
            <ArrowUpRight size={13} />
          </a>
          <button onClick={open}>
            Open workbench <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span />
            COMPUTER-USE, WITH A MEMORY.
          </p>
          <h1>
            Let AI find the way.
            <br />
            <em>Make it repeatable.</em>
          </h1>
          <p className="hero-description">
            Relay turns a successful UI interaction into a reusable capability.
            A model discovers the workflow. A deterministic engine runs it
            again—with clear outcomes and a human ready to take over.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={open}>
              Open the workbench
              <ArrowRight size={17} />
            </button>
            <a href="#demo">
              <Play size={15} />
              Watch the 2-minute demo
            </a>
          </div>
          <div className="hero-facts">
            <span>
              <CheckCircle2 />
              No sign-in
            </span>
            <span>
              <ShieldCheck />
              Synthetic data
            </span>
            <span>
              <Braces />
              Open source
            </span>
          </div>
        </div>
        <div className="hero-system">
          <div className="system-top">
            <span className="status-dot" />
            RELAY EXECUTION ENGINE<span>01—03</span>
          </div>
          <div className="system-goal">
            <small>THE GOAL</small>
            <p>“Read this member’s savings balance.”</p>
          </div>
          <div className="system-node">
            <span>01</span>
            <div>
              <b>Discover</b>
              <p>Observe → decide → act</p>
            </div>
            <span className="node-tag">LOCAL LLM</span>
          </div>
          <div className="system-connector" />
          <div className="system-node">
            <span>02</span>
            <div>
              <b>Record</b>
              <p>Typed inputs. Verified checkpoints.</p>
            </div>
            <Braces size={21} />
          </div>
          <div className="system-connector" />
          <div className="system-node replay-node">
            <span>03</span>
            <div>
              <b>Replay</b>
              <p>Saved rules. No model decisions.</p>
            </div>
            <CheckCircle2 size={21} />
          </div>
          <div className="system-bottom">
            <Hand size={15} />
            Blocked? Pause. Hand over. Resume.
          </div>
        </div>
      </div>
      <div className="landing-proof">
        <span>FROM INTENT TO EXECUTION</span>
        <p>Real UI discovery</p>
        <i />
        <p>Versioned capabilities</p>
        <i />
        <p>Deterministic replay</p>
        <i />
        <p>Live-session handoff</p>
      </div>
      <div className="landing-section" id="how">
        <div className="section-intro">
          <p className="eyebrow">
            ONE WORKFLOW. THREE DISTINCT RESPONSIBILITIES.
          </p>
          <h2>
            Intelligence at discovery.
            <br />
            Control at execution.
          </h2>
          <p>
            Built for the applications that only have a user interface. Explore
            the complete flow in a local-first banking sandbox.
          </p>
        </div>
        <div className="feature-grid">
          {[
            {
              n: '01',
              title: 'Learn from the live screen',
              body: 'A local language model chooses actions from the current UI. Every observation and action becomes inspectable evidence.',
              icon: Workflow,
            },
            {
              n: '02',
              title: 'Keep the contract',
              body: 'Store the workflow as a typed, versioned artifact with parameters, outputs, targeting rules and a success checkpoint.',
              icon: Braces,
            },
            {
              n: '03',
              title: 'Expect the unexpected',
              body: 'Separate business outcomes from recoverable errors. Pause uncertain runs and give a person the existing live session.',
              icon: Hand,
            },
          ].map(({ n, title, body, icon: Icon }) => (
            <div key={n}>
              <div>
                <Icon size={24} />
                <span>{n}</span>
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="demo-section" id="demo">
        <div>
          <p className="eyebrow">SEE THE WHOLE LOOP</p>
          <h2>
            Two minutes.
            <br />
            From goal to evidence.
          </h2>
          <p>
            A recorded walkthrough of the working product: discovery, reusable
            artifacts, replay, exceptional states and human takeover.
          </p>
          <a
            className="text-link"
            href="https://github.com/Utsavd7/relay-computer-use/tree/main/evidence"
            target="_blank"
            rel="noreferrer"
          >
            Inspect the supporting evidence
            <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="video-shell">
          <video
            poster="demo-poster.jpg"
            controls
            preload="metadata"
            playsInline
            aria-label="Relay two-minute product walkthrough"
          >
            <source src="demo.mp4" type="video/mp4" />
            <track
              kind="captions"
              src="demo.vtt"
              srcLang="en"
              label="English"
              default
            />
            Your browser does not support embedded video.
          </video>
        </div>
      </div>
      <div className="landing-cta">
        <div>
          <p className="eyebrow">TRY IT YOURSELF</p>
          <h2>
            Run the workflow.
            <br />
            Inspect every decision.
          </h2>
          <p>
            Replay is ready immediately. Discovery downloads a local model and
            requires a WebGPU-capable browser.
          </p>
        </div>
        <button className="primary" onClick={open}>
          Enter the workbench
          <ArrowRight size={17} />
        </button>
      </div>
      <div className="landing-footer">
        <a className="brand" href="./">
          <img src="favicon.svg" alt="" />
          relay<span>.</span>
        </a>
        <p>
          Relay · Computer-use automation
          <br />
          <small>
            Training environment only. No real banking integrations.
          </small>
        </p>
        <a href="https://github.com/Utsavd7/relay-computer-use">
          View repository
          <ArrowUpRight size={14} />
        </a>
      </div>
    </div>
  );
}
