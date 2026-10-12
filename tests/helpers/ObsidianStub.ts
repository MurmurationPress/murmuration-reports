// Test-only boundary doubles. Never included by the production build.
export class TFile {
  extension = "md";
  constructor(public path: string) {
    this.extension = path.split(".").pop()!;
  }
}
export const getFrontMatterInfo = (raw: string) =>
  raw.startsWith("---\n")
    ? { exists: true, frontmatter: raw.slice(4, raw.indexOf("---", 4)) }
    : { exists: raw.startsWith("{"), frontmatter: raw };
export const parseYaml = (raw: string) => (raw.trim() ? JSON.parse(raw) : null);
class ElementStub {
  children: ElementStub[] = [];
  listeners = new Map<string, () => void>();
  constructor(public text = "") {}
  createEl(_tag: string, options: { text?: string } = {}) {
    const el = new ElementStub(options.text);
    this.children.push(el);
    return el;
  }
  addEventListener(name: string, callback: () => void) {
    this.listeners.set(name, callback);
  }
  empty() {
    this.children = [];
  }
  focus() {}
}
export class Modal {
  static openDialogs = new Set<Modal>();
  contentEl = new ElementStub();
  constructor(public app: unknown) {}
  onOpen() {}
  onClose() {}
  open() {
    Modal.openDialogs.add(this);
    this.onOpen();
  }
  close() {
    if (Modal.openDialogs.delete(this)) this.onClose();
  }
}
export class Notice {
  constructor(_text: string, _timeout?: number) {}
}
export class Plugin {
  callbacks: (() => void)[] = [];
  constructor(
    public app: any,
    public manifest: { id: string },
  ) {}
  register(callback: () => void) {
    this.callbacks.push(callback);
  }
  registerEvent(ref: { off: () => void }) {
    this.register(() => ref.off());
  }
  addCommand(command: any) {
    this.app.commandMap.set(
      this.manifest.id + ":" + command.id,
      command.callback,
    );
    this.register(() =>
      this.app.commandMap.delete(this.manifest.id + ":" + command.id),
    );
  }
  unload() {
    for (const callback of this.callbacks.reverse()) callback();
    this.callbacks = [];
  }
}
