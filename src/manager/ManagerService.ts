import { App, TFile, TFolder, EventRef } from "obsidian";
import {
  GenerationCoordinator,
  ReportResult,
  ReportDocument,
} from "../reports/GenerationCoordinator";
import { MutationQueue } from "../obsidian/MutationQueue";
import { reportVault } from "../obsidian/VaultAdapter";
import { ReportCatalogue, ReportEntry } from "./ReportCatalogue";
import {
  newDefinition,
  patchDefinition,
  Properties,
  readEditable,
} from "./DefinitionEditing";
import { parseDerivedArtefactDefinition } from "../core/DerivedArtefactDefinition";
import { safePath, pathKey, within } from "../reports/PathSafety";
import {
  digest,
  markerOwner,
  parseReceipt,
  receiptPath,
} from "../reports/OutputOwnership";
import { validateSvgAdoption } from "../obsidian/AssetValidation";
export interface DefinitionDraft {
  path: string;
  original: string | null;
  values: Properties;
  conflict?: string;
  manualDestinations?: { definition: boolean; output: boolean };
}
export interface SavedPreview {
  state: "available" | "missing" | "unverified" | "error";
  message: string;
  content?: string;
  path?: string;
}
export class ManagerService {
  readonly catalogue: ReportCatalogue;
  private active = true;
  private events: (() => void)[] = [];
  private vault;
  private unresolvedPaths = new Set<string>();
  private fallbackPaths = new Set<string>();
  private fallbackTimer?: ReturnType<typeof setTimeout>;
  private previewListeners = new Set<
    (path: string, oldPath?: string) => void
  >();
  constructor(
    readonly app: App,
    readonly coordinator: GenerationCoordinator,
    private queue: MutationQueue,
  ) {
    this.vault = reportVault(app, (ref) =>
      this.events.push(() => app.vault.offref(ref)),
    );
    const doc = (path: string) => {
      const f = app.vault.getAbstractFileByPath(path);
      if (!(f instanceof TFile) || f.extension !== "md") return undefined;
      const cache = app.metadataCache.getFileCache(f);
      if (!cache) this.unresolvedPaths.add(path);
      if (cache?.frontmatter) return { path, frontmatter: cache.frontmatter };
      const known = this.catalogue?.documentAt(path);
      if (known?.frontmatter?.world_entity === "derived-artefact")
        return {
          ...known,
          path,
          diagnostic:
            "Definition metadata is unreadable. Open definition to repair its YAML.",
        };
      if (
        cache?.frontmatterPosition ||
        cache?.sections?.some((s) => s.type === "yaml")
      ) {
        this.fallbackPaths.add(path);
        if (this.catalogue) this.queueFallback();
      }
      return { path };
    };
    this.catalogue = new ReportCatalogue({
      enumerate: () => app.vault.getMarkdownFiles().map((f) => doc(f.path)!),
      document: doc,
      kind: (p) => this.vault.kind(p),
      schedule: (work) => globalThis.setTimeout(work, 80),
      cancel: (h) => globalThis.clearTimeout(h as number),
    });
    const metadataRef = app.metadataCache.on("changed", (file, data, cache) => {
      if (!cache.frontmatter) this.seedMalformed(file.path, data);
      this.catalogue.changed(file.path);
    });
    this.events.push(() => app.metadataCache.offref(metadataRef));
    const resolvedRef = app.metadataCache.on("resolved", () => {
      for (const path of this.unresolvedPaths) this.catalogue.changed(path);
      this.unresolvedPaths.clear();
    });
    this.events.push(() => app.metadataCache.offref(resolvedRef));
    this.queueFallback();
    const change = (file: { path: string }) => {
      this.catalogue.structural();
      for (const listener of this.previewListeners) listener(file.path);
    };
    const vaultRefs = [
      app.vault.on("create", change),
      app.vault.on("modify", change),
      app.vault.on("delete", (file) => {
        this.catalogue.changed(file.path);
        change(file);
      }),
      app.vault.on("rename", (file, old) => {
        if (file instanceof TFolder) {
          for (const oldPath of this.catalogue.pathsUnder(old)) {
            const newPath = file.path + oldPath.slice(old.length);
            this.catalogue.renamed(oldPath, newPath);
            for (const listener of this.previewListeners)
              listener(newPath, oldPath);
          }
        } else this.catalogue.renamed(old, file.path);
        this.catalogue.structural();
        for (const listener of this.previewListeners) listener(file.path, old);
      }),
    ];
    for (const ref of vaultRefs) this.events.push(() => app.vault.offref(ref));
  }
  private seedMalformed(path: string, raw: string) {
    const fm = /^\uFEFF?---\r?\n([\s\S]*?)(?:^---[ \t]*(?:\r?\n|$))/m.exec(
      raw,
    )?.[1];
    if (
      fm &&
      /^[ \t]*world_entity:[ \t]*["']?derived-artefact["']?[ \t]*(?:#.*)?$/m.test(
        fm,
      )
    )
      this.catalogue.seed(
        path,
        { world_entity: "derived-artefact" },
        "Unreadable YAML definition. Open definition to repair its syntax.",
      );
  }
  private queueFallback() {
    if (
      this.fallbackTimer !== undefined ||
      !this.fallbackPaths.size ||
      !this.active
    )
      return;
    this.fallbackTimer = setTimeout(async () => {
      this.fallbackTimer = undefined;
      for (const path of [...this.fallbackPaths].slice(0, 16)) {
        this.fallbackPaths.delete(path);
        try {
          const raw = await this.vault.read(path);
          if (!this.active) return;
          this.seedMalformed(path, raw);
        } catch {}
      }
      this.queueFallback();
    }, 80);
  }
  onFileChange(callback: (path: string, old?: string) => void) {
    this.previewListeners.add(callback);
    return () => {
      this.previewListeners.delete(callback);
    };
  }
  ensureActive() {
    if (!this.active)
      throw Error("Reports was disabled; the draft has not been saved.");
  }
  async draft(path: string): Promise<DefinitionDraft> {
    const raw = await this.vault.read(path);
    this.ensureActive();
    return { path, original: raw, values: readEditable(raw).data };
  }
  /** Bounds property suggestions to cached observations; no files read and no completeness claim. */
  suggest(source: string) {
    const numeric = new Set<string>(),
      all = new Set<string>();
    let inspected = 0;
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (!within(f.path, source)) continue;
      if (++inspected > 200) break;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter ?? {};
      for (const [key, value] of Object.entries(fm)) {
        if (key === "position") continue;
        all.add(key);
        if (typeof value === "number") numeric.add(key);
      }
    }
    return {
      all: [...all].sort(),
      numeric: [...numeric].sort(),
      inspected: Math.min(inspected, 200),
    };
  }
  folders() {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((f) => f instanceof TFolder)
      .map((f) => f.path)
      .filter((p) => p !== "/")
      .sort();
  }
  private validate(
    draft: DefinitionDraft,
    data: Properties,
    fresh?: readonly ReportDocument[],
  ) {
    if (!safePath(draft.path) || !draft.path.toLowerCase().endsWith(".md"))
      throw Error(
        "Definition destination must be a portable vault-relative Markdown path.",
      );
    const def = parseDerivedArtefactDefinition(data);
    if (!safePath(def.source) || !safePath(def.output))
      throw Error("Use portable vault-relative source and output paths.");
    if (this.vault.kind(def.source) !== "folder")
      throw Error("Choose an existing dataset folder.");
    if (within(def.output, def.source) || within(draft.path, def.source))
      throw Error("Keep definitions and outputs outside the dataset folder.");
    if (pathKey(def.output) === pathKey(draft.path))
      throw Error("Output collides with the definition.");
    const files = this.app.vault.getAllLoadedFiles();
    for (const target of [draft.path, def.output]) {
      if (
        files.some(
          (f) => pathKey(f.path) === pathKey(target) && f.path !== target,
        )
      )
        throw Error("Destination has a case or Unicode collision: " + target);
      for (const parent of target
        .split("/")
        .slice(0, -1)
        .map((_, i) =>
          target
            .split("/")
            .slice(0, i + 1)
            .join("/"),
        )) {
        if (this.vault.kind(parent) === "file")
          throw Error("A destination parent is a file: " + parent);
      }
    }
    if (this.vault.kind(def.output) === "folder")
      throw Error("Output destination is a folder.");
    const declarations = fresh ?? this.vault.documents();
    for (const document of declarations) {
      const fm = document.frontmatter,
        output = fm?.output,
        source = fm?.source;
      if (
        document.path !== draft.path &&
        fm?.world_entity === "derived-artefact" &&
        typeof output === "string" &&
        pathKey(output.trim()) === pathKey(def.output)
      )
        throw Error("Another report declares this output: " + document.path);
      if (
        safePath(source) &&
        (within(def.output, source) ||
          (draft.original === null && within(draft.path, source)))
      )
        throw Error(
          "Keep new definitions and outputs outside every declared dataset folder.",
        );
      if (
        document.path !== def.output &&
        pathKey(document.path) === pathKey(def.output)
      )
        throw Error("Output aliases another note.");
    }
    // Save-only can retain an existing declaration; a newly selected occupied destination needs ownership action later.
    const originalOutput =
      draft.original === null ? null : readEditable(draft.original).data.output;
    if (def.output !== originalOutput && this.vault.kind(def.output) !== null)
      throw Error(
        "The output destination is occupied. Choose an unused destination; use explicit adoption on an existing definition.",
      );
  }
  async save(draft: DefinitionDraft): Promise<string> {
    const currentDraft = draft;
    draft = { ...draft, values: structuredClone(draft.values) };
    const next =
      draft.original === null
        ? newDefinition(draft.values)
        : patchDefinition(draft.original, draft.values);
    const execute = async () => {
      this.ensureActive();
      this.validate(draft, draft.values);
      // Explicit saves validate fresh declarations, not a possibly lagging UI projection.
      const inputPaths = this.app.vault
        .getMarkdownFiles()
        .map((f) => f.path)
        .filter((p) => p !== draft.path)
        .sort();
      const versions = new Map<string, number>(),
        fresh: ReportDocument[] = [];
      for (const path of inputPaths) {
        versions.set(path, this.vault.version?.(path) ?? 0);
        try {
          fresh.push(await this.vault.readDocument(path));
        } catch (error) {
          throw Error(
            path +
              ": declarations are unreadable. Repair its frontmatter before saving (" +
              String(error) +
              ").",
          );
        }
      }
      this.ensureActive();
      this.validate(draft, draft.values, fresh);
      const guard = () => {
        this.ensureActive();
        if (
          JSON.stringify(
            this.app.vault
              .getMarkdownFiles()
              .map((f) => f.path)
              .filter((p) => p !== draft.path)
              .sort(),
          ) !== JSON.stringify(inputPaths) ||
          [...versions].some(
            ([path, version]) => (this.vault.version?.(path) ?? 0) !== version,
          )
        )
          throw Error(
            "Vault declarations changed while saving. Your draft is retained; retry after inspection.",
          );
        if (draft.original !== null && this.vault.kind(draft.path) !== "file")
          throw Error(
            "The definition moved or disappeared. Reload or reconcile; your draft is retained.",
          );
        this.validate(draft, draft.values, fresh);
      };
      if (draft.original === null) {
        if (this.vault.kind(draft.path))
          throw Error(
            "Definition destination is occupied. No file was renamed.",
          );
        let folder = "";
        for (const part of draft.path.split("/").slice(0, -1)) {
          this.ensureActive();
          folder = folder ? folder + "/" + part : part;
          if (!this.vault.kind(folder)) await this.vault.createFolder(folder);
        }
        await this.vault.create(draft.path, next, guard);
      } else {
        const latest = await this.vault.read(draft.path);
        if (latest !== draft.original) {
          currentDraft.conflict =
            "The definition changed externally. Your draft is retained. Reload or reconcile explicitly.";
          throw Error(currentDraft.conflict);
        }
        await this.vault.replace(draft.path, draft.original, next, guard);
      }
      this.ensureActive();
      if ((await this.vault.read(draft.path)) !== next)
        throw Error(
          "Saved definition could not be verified. Inspect it before retrying.",
        );
      currentDraft.original = next;
      currentDraft.conflict = undefined;
      this.catalogue.changed(draft.path);
      return draft.path;
    };
    const result = this.queue.tail.then(execute);
    this.queue.tail = result.catch(() => undefined);
    return result;
  }
  async generate(path?: string) {
    this.ensureActive();
    const results = path
      ? [await this.coordinator.generate(path)]
      : await this.coordinator.generateAll();
    if (this.active) this.recordMany(results);
    return results;
  }
  record(result: ReportResult) {
    this.recordMany([result]);
  }
  recordMany(results: readonly ReportResult[]) {
    this.catalogue.results(
      results.map((result) => ({
        definitionPath: result.definitionPath,
        status: result.status,
        message:
          result.message +
          (result.recoveryPaths?.length
            ? " Recovery copies: " + result.recoveryPaths.join(", ")
            : ""),
      })),
    );
  }
  async preview(entry: ReportEntry): Promise<SavedPreview> {
    if (entry.status === "invalid" || entry.status === "collision")
      return {
        state: "error",
        message:
          "Resolve the definition diagnostics before previewing an associated output.",
      };
    if (!safePath(entry.output))
      return { state: "error", message: "Invalid output destination." };
    if (this.vault.kind(entry.output) === null)
      return {
        state: "missing",
        message: "Saved output is missing. Generate explicitly to create it.",
      };
    try {
      const definition = (await this.vault.readDocument(entry.path))
        .frontmatter!;
      const parsed = parseDerivedArtefactDefinition(definition);
      if (parsed.output !== entry.output || parsed.artefactType !== entry.type)
        return {
          state: "unverified",
          message:
            "The definition changed. Refresh before inspecting this output.",
        };
      const content = await this.vault.read(entry.output),
        marker = markerOwner(content),
        rp = receiptPath(entry.output);
      let owner = marker;
      if (this.vault.kind(rp) !== null) {
        const r = parseReceipt(await this.vault.read(rp));
        if (
          r.outputPath !== entry.output ||
          r.digest !== (await digest(content)) ||
          (marker && marker !== r.definitionPath)
        )
          throw Error("Receipt or marker does not match the saved asset.");
        owner = r.definitionPath;
      }
      this.ensureActive();
      if (owner !== entry.path)
        return {
          state: "unverified",
          message: owner
            ? "Ownership refers to " +
              owner +
              ". Explicit ownership repair is required."
            : "Ownership is unverified. Inspect and adopt explicitly before previewing this asset.",
        };
      if (entry.type === "line-chart") {
        if (marker) throw Error("A table marker cannot own a chart.");
        validateSvgAdoption(content);
      }
      return {
        state: "available",
        message: "Saved output available",
        content,
        path: entry.output,
      };
    } catch (error) {
      return {
        state: "error",
        message: String(error instanceof Error ? error.message : error),
      };
    }
  }
  dispose() {
    this.active = false;
    if (this.fallbackTimer !== undefined) clearTimeout(this.fallbackTimer);
    this.fallbackPaths.clear();
    this.unresolvedPaths.clear();
    this.catalogue.dispose();
    for (const dispose of this.events) dispose();
    this.events = [];
    this.previewListeners.clear();
  }
}
