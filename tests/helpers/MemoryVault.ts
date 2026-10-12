import {
  ReportDocument,
  ReportVault,
} from "../../src/reports/GenerationCoordinator";
export const chart = {
  world_entity: "derived-artefact",
  artefact_type: "line-chart",
  source: "Data Ω",
  x: "date",
  series: [{ property: "value", label: "Measured value" }],
  title: "Persistent chart Ω",
  output: "Saved reports Ω/Trend.svg",
};
export const table = {
  world_entity: "derived-artefact",
  artefact_type: "state-table",
  source: "Data Ω",
  x: "date",
  parameters: [{ property: "value", label: "Measured value" }],
  output: "Saved reports Ω/State.md",
};
export class MemoryVault implements ReportVault {
  files = new Map<string, string>();
  folders = new Set<string>(["Definitions", "Data Ω"]);
  mutations: { path: string; content: string }[] = [];
  versions = new Map<string, number>();
  version(path: string) {
    return this.versions.get(path) ?? 0;
  }
  hook: ((operation: string, path: string) => void) | null = null;
  constructor(definition: Record<string, unknown> = chart) {
    this.note("Definitions/Report.md", definition);
    this.note("Data Ω/A.md", { date: "2029-01-01", value: 1 });
    this.note("Data Ω/B.md", { date: "2029-02-01", value: 2 });
  }
  note(path: string, fm: Record<string, unknown>): void {
    this.files.set(path, JSON.stringify(fm));
    this.versions.set(path, this.version(path) + 1);
  }
  documents(): ReportDocument[] {
    return [...this.files]
      .filter(([p]) => p.endsWith(".md"))
      .map(([path, raw]) => {
        let frontmatter;
        try {
          frontmatter = JSON.parse(raw);
        } catch {}
        return { path, frontmatter };
      });
  }
  async readDocument(path: string): Promise<ReportDocument> {
    const raw = await this.read(path);
    let frontmatter;
    try {
      frontmatter = JSON.parse(raw);
    } catch {}
    return { path, frontmatter };
  }
  kind(path: string): "file" | "folder" | null {
    return this.files.has(path)
      ? "file"
      : this.folders.has(path)
        ? "folder"
        : null;
  }
  async read(path: string): Promise<string> {
    this.hook?.("read", path);
    if (!this.files.has(path)) throw Error(`${path} missing`);
    return this.files.get(path)!;
  }
  async create(
    path: string,
    content: string,
    guard?: () => void,
  ): Promise<void> {
    this.hook?.("create", path);
    guard?.();
    if (this.kind(path)) throw Error("exists");
    this.files.set(path, content);
    this.mutations.push({ path, content });
    this.hook?.("created", path);
  }
  async replace(
    path: string,
    expected: string,
    content: string,
    guard?: () => void,
  ): Promise<void> {
    this.hook?.("replace", path);
    guard?.();
    if (this.files.get(path) !== expected) throw Error("concurrent content");
    this.files.set(path, content);
    this.mutations.push({ path, content });
    this.hook?.("replaced", path);
  }
  async createFolder(path: string): Promise<void> {
    if (this.kind(path)) throw Error("exists");
    this.folders.add(path);
  }
}
