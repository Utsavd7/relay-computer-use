import type {
  Action,
  Locator,
  Observation,
  Params,
  Policy,
  Surface,
} from './schema';
import { defaultPolicy, PolicySchema, safeControls } from './schema';
import { redact } from './privacy';
function documents(root: Document): Document[] {
  return [
    root,
    ...Array.from(root.querySelectorAll('iframe')).flatMap((f) => {
      try {
        if (!f.contentDocument) throw Error('POLICY_FRAME_DENIED');
        return documents(f.contentDocument);
      } catch {
        throw Error('POLICY_FRAME_DENIED');
      }
    }),
  ];
}
const visible = (e: Element) => {
  const style = e.ownerDocument.defaultView!.getComputedStyle(e);
  return (
    !!e.getClientRects().length &&
    style.visibility === 'visible' &&
    style.display !== 'none' &&
    !e.closest('[inert]')
  );
};
const name = (e: Element) =>
  e.getAttribute('aria-label') ||
  (e instanceof e.ownerDocument.defaultView!.HTMLInputElement
    ? (e as HTMLInputElement).labels?.[0]?.textContent ||
      e.closest('td')?.previousElementSibling?.textContent ||
      e.getAttribute('placeholder')
    : e.textContent) ||
  '';
function elements(d: Document) {
  return documents(d).flatMap((doc) =>
    Array.from(
      doc.querySelectorAll('button,input:not([type=hidden]),a,[role=button]'),
    ).filter(visible),
  );
}
export class BrowserSurface implements Surface {
  private base: URL;
  constructor(
    private root: () => Document,
    private policy: Policy = defaultPolicy,
  ) {
    this.policy = PolicySchema.parse(policy);
    this.base = new URL('.', this.root().URL);
    this.check();
  }
  route() {
    return new URL(this.root().URL).pathname;
  }
  version() {
    this.check();
    return (
      documents(this.root())
        .map((d) => d.documentElement.getAttribute('data-version'))
        .find(Boolean) || 'unknown'
    );
  }
  private check() {
    for (const d of documents(this.root())) {
      const u = new URL(d.URL);
      if (
        u.origin !== this.base.origin ||
        !this.policy.routes.some(
          (r) => u.pathname === new URL(r.slice(1), this.base).pathname,
        )
      )
        throw Error('POLICY_ROUTE_DENIED');
    }
  }
  async observe(): Promise<Observation> {
    this.check();
    const controls = elements(this.root())
      .filter((e) =>
        (e.tagName === 'INPUT'
          ? safeControls.fill
          : safeControls.click
        ).includes(name(e).trim()),
      )
      .map((e, ref) => ({
        ref,
        name: name(e).trim(),
        kind: (e.tagName === 'INPUT' ? 'field' : 'control') as
          | 'field'
          | 'control'
          | 'text',
        ...(e.tagName === 'INPUT'
          ? {
              state: ((e as HTMLInputElement).value ? 'filled' : 'empty') as
                | 'empty'
                | 'filled',
            }
          : {}),
      }));
    const texts = documents(this.root())
      .map((d) => {
        const c = d.body.cloneNode(true) as HTMLElement;
        c.querySelectorAll('script,style,iframe').forEach((e) => e.remove());
        c.querySelectorAll('[data-sensitive]').forEach(
          (e) => (e.textContent = '[REDACTED]'),
        );
        return c.textContent || '';
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .slice(0, 6000);
    if (await this.has('Account overview'))
      controls.push({
        ref: controls.length,
        name: 'Savings balance',
        kind: 'text',
      });
    return { text: String(redact(texts)), controls };
  }
  private resolve(loc: Locator): Element {
    let found: Element[] = [];
    for (const doc of documents(this.root())) {
      if (loc.kind === 'text') {
        found.push(
          ...Array.from(doc.querySelectorAll('td,th')).filter(
            (e) => visible(e) && e.textContent?.trim() === loc.name,
          ),
        );
      } else
        found.push(
          ...elements(doc).filter(
            (e) =>
              name(e).trim() === loc.name &&
              (loc.kind !== 'field' || e.tagName === 'INPUT'),
          ),
        );
    }
    found = [...new Set(found)];
    if (found.length !== 1)
      throw Error(found.length ? 'AMBIGUOUS_TARGET' : 'TARGET_NOT_FOUND');
    return found[0];
  }
  async act(action: Action, params: Params) {
    this.check();
    if (!this.policy.actions.includes(action.action))
      throw Error('POLICY_ACTION_DENIED');
    const e = this.resolve(action.target);
    if (
      !visible(e) ||
      e.matches(':disabled') ||
      (action.action === 'fill' && e.hasAttribute('readonly'))
    )
      throw Error('POLICY_CONTROL_UNAVAILABLE');
    if (
      /submit transfer|delete|finalize|send money|close account/i.test(name(e))
    )
      throw Error('POLICY_RISKY_ACTION');
    if (!safeControls[action.action].includes(action.target.name))
      throw Error('POLICY_CONTROL_DENIED');
    if (action.action === 'click') {
      if (action.target.kind !== 'control' || e.tagName !== 'BUTTON')
        throw Error('POLICY_CONTROL_TYPE');
      const button = e as HTMLButtonElement;
      if (button.form && button.type === 'submit')
        throw Error('POLICY_NAVIGATION_DENIED');
      (e as HTMLElement).click();
      return;
    }
    if (action.action === 'fill') {
      if (
        action.target.kind !== 'field' ||
        e.tagName !== 'INPUT' ||
        !['text', 'search', 'number', 'tel'].includes(
          (e as HTMLInputElement).type,
        )
      )
        throw Error('POLICY_FIELD_DENIED');
      (e as HTMLInputElement).value = params[action.input];
      e.dispatchEvent(
        new e.ownerDocument.defaultView!.Event('input', { bubbles: true }),
      );
      return;
    }
    if (action.target.kind !== 'text' || !['TD', 'TH'].includes(e.tagName))
      throw Error('POLICY_CONTROL_TYPE');
    const value = e.nextElementSibling?.textContent?.trim() || '';
    const match = value.match(/^([A-Z]{3})\s+([\d,]+\.\d{2})$/);
    if (!match) throw Error('OUTPUT_SHAPE_MISMATCH');
    return {
      balance: Number(match[2].replaceAll(',', '')),
      currency: match[1],
    };
  }
  async has(text: string) {
    this.check();
    return documents(this.root()).some((d) =>
      (d.body.innerText || '').includes(text),
    );
  }
  async identity() {
    this.check();
    for (const d of documents(this.root())) {
      const cell = Array.from(d.querySelectorAll('td,th')).find(
        (e) =>
          e.textContent?.trim() === 'Member ID' &&
          e.nextElementSibling?.hasAttribute('data-sensitive'),
      );
      if (cell) return cell.nextElementSibling?.textContent?.trim() || '';
    }
    return '';
  }
  async evidence() {
    const o = await this.observe();
    return JSON.stringify(
      {
        kind: 'redacted-ui-snapshot',
        route: this.route(),
        version: this.version(),
        ...o,
      },
      null,
      2,
    );
  }
  onHumanAction(listener: (detail: unknown) => void) {
    const handlers = documents(this.root()).map((d) => {
      const handle = (event: globalThis.Event) => {
        const e = event.target as Element;
        if (e?.matches('input,button,a,[role=button]'))
          listener({
            event: event.type,
            target: name(e).trim(),
            value: event.type === 'input' ? '[REDACTED]' : undefined,
          });
      };
      d.addEventListener('click', handle, true);
      d.addEventListener('input', handle, true);
      return () => {
        d.removeEventListener('click', handle, true);
        d.removeEventListener('input', handle, true);
      };
    });
    return () => handlers.forEach((f) => f());
  }
}
