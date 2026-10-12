import { ReportDocument } from "../reports/GenerationCoordinator";
import { parseDerivedArtefactDefinition } from "../core/DerivedArtefactDefinition";
import { pathKey, safePath, within } from "../reports/PathSafety";
export interface ReportEntry {
  path: string;
  name: string;
  type: string;
  source: string;
  output: string;
  frontmatter: Record<string, unknown>;
  diagnostics: string[];
  status: string;
}
export interface CatalogueHost {
  enumerate(): readonly ReportDocument[];
  document(path: string): ReportDocument | undefined;
  kind(path: string): "file" | "folder" | null;
  schedule(work: () => void): unknown;
  cancel(handle: unknown): void;
}
/** Metadata projection only: no file reads, output reads or observation parsing. */
export class ReportCatalogue {
  private cached: ReportEntry[] | undefined;
  private docs = new Map<string, ReportDocument & { diagnostic?: string }>();
  private definitions = new Map<
    string,
    ReportDocument & { diagnostic?: string }
  >();
  private sources = new Map<string, number>();
  private destinations = new Map<string, Set<string>>();
  private aliases = new Map<string, Set<string>>();
  private pending = new Set<string>();
  private handle: unknown;
  private stopped = false;
  private listeners = new Set<() => void>();
  readonly outcomes = new Map<string, { status: string; message: string }>();
  constructor(private host: CatalogueHost) {
    this.reset();
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(invalidate = true) {
    if (invalidate) this.cached = undefined;
    for (const listener of this.listeners) listener();
  }
  private remove(path: string) {
    const old = this.docs.get(path);
    if (!old) return;
    const source = old.frontmatter?.source;
    if (safePath(source)) {
      const n = (this.sources.get(source) ?? 1) - 1;
      if (n) this.sources.set(source, n);
      else this.sources.delete(source);
    }
    const output = old.frontmatter?.output;
    if (this.definitions.has(path) && typeof output === "string") {
      const key = pathKey(output.trim()),
        set = this.destinations.get(key);
      set?.delete(path);
      if (!set?.size) this.destinations.delete(key);
    }
    const key = pathKey(path),
      aliases = this.aliases.get(key);
    aliases?.delete(path);
    if (!aliases?.size) this.aliases.delete(key);
    this.docs.delete(path);
    this.definitions.delete(path);
    this.cached = undefined;
  }
  private put(doc: ReportDocument & { diagnostic?: string }) {
    this.remove(doc.path);
    this.docs.set(doc.path, doc);
    this.cached = undefined;
    const key = pathKey(doc.path);
    if (!this.aliases.has(key)) this.aliases.set(key, new Set());
    this.aliases.get(key)!.add(doc.path);
    const source = doc.frontmatter?.source;
    if (safePath(source))
      this.sources.set(source, (this.sources.get(source) ?? 0) + 1);
    if (doc.frontmatter?.world_entity === "derived-artefact") {
      this.definitions.set(doc.path, doc);
      const output = doc.frontmatter.output;
      if (typeof output === "string") {
        const outKey = pathKey(output.trim());
        if (!this.destinations.has(outKey))
          this.destinations.set(outKey, new Set());
        this.destinations.get(outKey)!.add(doc.path);
      }
    }
  }
  pathsUnder(folder: string) {
    return [...this.docs.keys()].filter((path) => within(path, folder));
  }
  documentAt(path: string) {
    return this.docs.get(path);
  }
  seed(path: string, frontmatter: Record<string, unknown>, diagnostic: string) {
    this.put({ path, frontmatter, diagnostic });
    this.changed(path);
  }
  reset() {
    if (this.stopped) return;
    const documents = this.host.enumerate();
    this.docs.clear();
    this.definitions.clear();
    this.sources.clear();
    this.destinations.clear();
    this.aliases.clear();
    for (const doc of documents) this.put(doc);
    this.emit();
  }
  changed(path: string) {
    if (this.stopped) return;
    this.pending.add(path);
    this.queue();
  }
  structural() {
    if (!this.stopped) this.queue();
  }
  renamed(oldPath: string, newPath: string) {
    const old = this.docs.get(oldPath);
    this.remove(oldPath);
    if (old) this.put({ ...old, path: newPath });
    const result = this.outcomes.get(oldPath);
    if (result) {
      this.outcomes.delete(oldPath);
      this.outcomes.set(newPath, result);
    }
    this.changed(newPath);
  }
  private queue() {
    if (this.handle !== undefined) return;
    this.handle = this.host.schedule(() => {
      this.handle = undefined;
      this.flush();
    });
  }
  private flush() {
    if (this.stopped) return;
    const paths = [...this.pending].slice(0, 64);
    for (const path of paths) {
      this.pending.delete(path);
      const doc = this.host.document(path);
      if (doc) this.put(doc);
      else this.remove(path);
    }
    this.emit();
    if (this.pending.size) this.queue();
  }
  result(path: string, status: string, message: string) {
    this.results([{ definitionPath: path, status, message }]);
  }
  results(
    results: readonly {
      definitionPath: string;
      status: string;
      message: string;
    }[],
  ) {
    for (const result of results)
      this.outcomes.set(result.definitionPath, {
        status: result.status,
        message: result.message,
      });
    this.emit(false);
  }
  entries(): ReportEntry[] {
    if (this.cached) return this.cached;
    const defs = [...this.definitions.values()];
    const allSources = [...this.sources.keys()];
    return (this.cached = defs
      .map((d) => {
        const f = d.frontmatter!,
          str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
        const entry: ReportEntry = {
          path: d.path,
          name: str(f.title) || d.path.split("/").pop()!.replace(/\.md$/i, ""),
          type: str(f.artefact_type),
          source: str(f.source),
          output: str(f.output),
          frontmatter: f,
          diagnostics: [],
          status: "ready",
        };
        if (d.diagnostic) {
          entry.diagnostics.push(d.diagnostic);
          entry.status = "invalid";
        }
        try {
          parseDerivedArtefactDefinition(f);
          if (!safePath(entry.source) || !safePath(entry.output))
            throw Error(
              "Source and output must be portable vault-relative paths.",
            );
        } catch (e) {
          entry.diagnostics.push(
            "Invalid definition: " + String(e instanceof Error ? e.message : e),
          );
          entry.status = "invalid";
        }
        if (entry.source && this.host.kind(entry.source) !== "folder") {
          entry.diagnostics.push("Dataset folder is missing.");
          if (entry.status === "ready") entry.status = "missing-source";
        }
        if (entry.output) {
          const peers = this.destinations.get(pathKey(entry.output))?.size ?? 0;
          const collision =
            peers > 1 ||
            allSources.some((s) => within(entry.output, s)) ||
            [...(this.aliases.get(pathKey(entry.output)) ?? [])].some(
              (p) => pathKey(p) === pathKey(entry.output) && p !== entry.output,
            ) ||
            this.definitions.has(entry.output) ||
            pathKey(entry.output) === pathKey(d.path) ||
            this.host.kind(entry.output) === "folder";
          if (collision) {
            entry.diagnostics.push(
              "Output collision: another definition, source or folder claims this destination.",
            );
            entry.status = "collision";
          } else if (this.host.kind(entry.output) === null) {
            entry.diagnostics.push(
              "Saved output is missing. Generate explicitly to create it.",
            );
            if (entry.status === "ready") entry.status = "missing-output";
          }
        }
        return entry;
      })
      .sort(
        (a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path),
      ));
  }
  dispose() {
    this.stopped = true;
    if (this.handle !== undefined) this.host.cancel(this.handle);
    this.pending.clear();
    this.listeners.clear();
  }
}
