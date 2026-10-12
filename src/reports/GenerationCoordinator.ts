import {
  DerivedArtefactDefinition,
  isDerivedArtefactDefinition,
  parseDerivedArtefactDefinition,
} from "../core/DerivedArtefactDefinition";
import { normaliseLineChartData } from "../core/LineChartData";
import { renderLineChartSvg } from "../core/LineChartSvg";
import { normaliseStateTableData } from "../core/StateTableData";
import { renderStateTableMarkdown } from "../core/StateTableMarkdown";
import {
  digest,
  markerOwner,
  OutputReceipt,
  parseReceipt,
  receiptPath,
  serialiseReceipt,
  tableMarker,
} from "./OutputOwnership";

export interface ReportDocument {
  readonly path: string;
  readonly frontmatter?: Record<string, unknown>;
}
export interface ReportVault {
  documents(): readonly ReportDocument[];
  readDocument(path: string): Promise<ReportDocument>;
  kind(path: string): "file" | "folder" | null;
  read(path: string): Promise<string>;
  /** Create fails if the destination exists. */
  create(path: string, content: string): Promise<void>;
  /** Compare and replace using Vault.process; cannot lock external sync or multiple files. */
  replace(path: string, expected: string, content: string): Promise<void>;
  removeCreated(path: string, expected: string): Promise<void>;
  createFolder(path: string): Promise<void>;
}
export interface ReportResult {
  readonly definitionPath: string;
  readonly outputPath?: string;
  readonly status: "created" | "replaced" | "unchanged" | "blocked" | "failed";
  readonly message: string;
  readonly observations?: number;
  readonly recoveryPaths?: readonly string[];
}
export interface AdoptionInspection {
  readonly definitionPath: string;
  readonly outputPath: string;
  readonly digest: string;
  readonly definitionDigest: string;
  readonly previousOwner: string | null;
  readonly content: string;
}
interface Plan {
  definition: DerivedArtefactDefinition;
  definitionPath: string;
  content: string;
  observations: number;
  snapshots: Map<string, string>;
  inventory: string;
  output: string | null;
  receipt: string | null;
}
class Blocked extends Error {}
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
function safePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    !!path &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !/[\x00-\x1f]/.test(path) &&
    path.split("/").every((p) => !!p && p !== "." && p !== "..")
  );
}
export class GenerationCoordinator {
  private tail: Promise<unknown> = Promise.resolve();
  private disposed = false;
  private inspections = new WeakSet<AdoptionInspection>();
  constructor(private readonly vault: ReportVault) {}
  dispose(): void {
    this.disposed = true;
  }
  private active(): void {
    if (this.disposed)
      throw new Blocked("Reports was disabled; no further writes are allowed.");
  }
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => {
      this.active();
      return task();
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
  private inventory(source: string): string {
    return JSON.stringify(
      this.vault
        .documents()
        .map((d) => d.path)
        .sort(),
    );
  }
  private async freshDocuments(
    snapshots?: Map<string, string>,
  ): Promise<ReportDocument[]> {
    const result: ReportDocument[] = [];
    for (const item of this.vault.documents()) {
      if (snapshots && !snapshots.has(item.path))
        snapshots.set(item.path, await this.vault.read(item.path));
      try {
        result.push(await this.vault.readDocument(item.path));
      } catch {
        result.push(item);
      } // Preserve known invalid definitions; their own generation reports errors.
    }
    return result;
  }
  private async optional(path: string): Promise<string | null> {
    if (this.vault.kind(path) === "folder")
      throw new Blocked(`${path} is a folder.`);
    return this.vault.kind(path) === "file" ? this.vault.read(path) : null;
  }
  private async plan(path: string): Promise<Plan> {
    this.active();
    if (!safePath(path)) throw new Blocked("Invalid definition path.");
    const snapshots = new Map<string, string>();
    snapshots.set(path, await this.vault.read(path));
    const document = await this.vault.readDocument(path);
    const definition = parseDerivedArtefactDefinition(
      document.frontmatter ?? {},
    );
    if (!safePath(definition.source) || !safePath(definition.output))
      throw new Blocked("Invalid source or output path.");
    if (this.vault.kind(definition.source) !== "folder")
      throw new Blocked(`Source folder is missing: ${definition.source}`);
    const inventory = this.inventory(definition.source);
    // Explicit commands scan fresh frontmatter, never trusting a lagging metadata cache for collisions.
    const documents = await this.freshDocuments(snapshots);
    const definitions = documents.filter((d) =>
      isDerivedArtefactDefinition(d.frontmatter),
    );
    const sources = [definition.source];
    for (const item of definitions) {
      if (!snapshots.has(item.path))
        snapshots.set(item.path, await this.vault.read(item.path));
      const fm = (await this.vault.readDocument(item.path)).frontmatter ?? {};
      // Protect usable source/output declarations even if another definition is invalid.
      const source = typeof fm.source === 'string' ? fm.source.trim() : null;
      const output = typeof fm.output === 'string' ? fm.output.trim() : null;
      if (safePath(source)) sources.push(source);
      if (item.path !== path && output === definition.output)
        throw new Blocked(
          `Competing definition ${item.path} declares ${definition.output}.`,
        );
    }
    if (
      documents.some(
        (d) =>
          d.path === definition.output &&
          (d.path === path || isDerivedArtefactDefinition(d.frontmatter)),
      ) ||
      sources.some((source) => definition.output.startsWith(`${source}/`))
    )
      throw new Blocked("Output collides with a source or definition.");
    if (
      definition.artefactType === "line-chart" &&
      documents.some(
        (d) => d.path === definition.output.replace(/\.svg$/i, ".md"),
      )
    )
      throw new Blocked("SVG output collides with a Markdown note.");
    for (const suffix of ["", ".murmuration-report.json"]) {
      const target = definition.output + suffix;
      if (
        sources.some((source) => target.startsWith(`${source}/`)) ||
        definitions.some((d) => d.path === target)
      )
        throw new Blocked(
          "Output metadata collides with a source or definition.",
        );
      for (const parent of target
        .split("/")
        .slice(0, -1)
        .map((_, i, a) => a.slice(0, i + 1).join("/")))
        if (this.vault.kind(parent) === "file")
          throw new Blocked(`Output parent is a file: ${parent}`);
    }
    const records: { path: string; frontmatter: Record<string, unknown> }[] =
      [];
    for (const item of documents
      .filter((d) => d.path.startsWith(`${definition.source}/`))
      .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
      const raw = await this.vault.read(item.path);
      if (!snapshots.has(item.path)) snapshots.set(item.path, raw);
      records.push({
        path: item.path,
        frontmatter:
          (await this.vault.readDocument(item.path)).frontmatter ?? {},
      });
    }
    let content: string, observations: number;
    if (definition.artefactType === "line-chart") {
      const data = normaliseLineChartData(definition, records);
      content = renderLineChartSvg(data);
      observations = data.points.length;
    } else {
      const data = normaliseStateTableData(definition, records);
      content = `${renderStateTableMarkdown(data)}\n${tableMarker(path)}\n`;
      observations = data.observations.length;
    }
    const output = await this.optional(definition.output),
      receipt = await this.optional(receiptPath(definition.output));
    return {
      definition,
      definitionPath: path,
      content,
      observations,
      snapshots,
      inventory,
      output,
      receipt,
    };
  }
  private async recheck(p: Plan): Promise<void> {
    this.active();
    if (
      this.inventory(p.definition.source) !== p.inventory ||
      this.vault.kind(p.definition.source) !== "folder"
    )
      throw new Blocked("Source or definition inventory changed; retry.");
    for (const [path, raw] of p.snapshots)
      if (
        this.vault.kind(path) !== "file" ||
        (await this.vault.read(path)) !== raw
      )
        throw new Blocked(`${path} changed; retry.`);
    if (
      (await this.optional(p.definition.output)) !== p.output ||
      (await this.optional(receiptPath(p.definition.output))) !== p.receipt
    )
      throw new Blocked("Output or receipt changed; inspect again.");
    this.active();
  }
  private async owner(p: Plan, repair = false): Promise<string | null> {
    const marker = p.output === null ? null : markerOwner(p.output);
    let owner = marker;
    if (p.receipt !== null) {
      let r: OutputReceipt;
      try {
        r = parseReceipt(p.receipt);
      } catch (error) {
        throw new Blocked(errorText(error));
      }
      if (
        p.output === null ||
        r.outputPath !== p.definition.output ||
        r.digest !== (await digest(p.output))
      )
        throw new Blocked(
          "Receipt does not match the output; restore the asset or receipt before adoption.",
        );
      if (marker && marker !== r.definitionPath)
        throw new Blocked("Receipt and table marker have conflicting owners.");
      owner = r.definitionPath;
    }
    if (owner && owner !== p.definitionPath) {
      if (!safePath(owner))
        throw new Blocked("Invalid ownership definition path.");
      if (!repair || this.vault.kind(owner) !== null)
        throw new Blocked(
          `Output belongs to ${owner}. Explicit repair is allowed only after the former definition is absent.`,
        );
    }
    return owner;
  }
  async inspectAdoption(path: string): Promise<AdoptionInspection> {
    return this.serial(async () => {
      const p = await this.plan(path);
      if (p.output === null)
        throw new Blocked(
          "No existing output to adopt. Generate a new output instead.",
        );
      const previousOwner = await this.owner(p, true);
      if (
        p.definition.artefactType === "line-chart" &&
        !/^\s*(?:<\?xml[^>]*>\s*)?<svg\b[\s\S]*<\/svg>\s*$/.test(p.output)
      )
        throw new Blocked(
          "The existing output is not a supported SVG document.",
        );
      if (
        p.definition.artefactType === "state-table" &&
        !/^\|parameter\|current\|previous\|Δ\|\r?\n\|---\|---:\|---:\|---:\|/.test(
          p.output,
        )
      )
        throw new Blocked(
          "The existing output is not a supported state table.",
        );
      await this.recheck(p);
      const inspection = Object.freeze({
        definitionPath: path,
        outputPath: p.definition.output,
        digest: await digest(p.output),
        definitionDigest: await digest(p.snapshots.get(path)!),
        previousOwner,
        content: p.output,
      });
      this.inspections.add(inspection);
      return inspection;
    });
  }
  async adoptAndGenerate(
    inspection: AdoptionInspection,
  ): Promise<ReportResult> {
    return this.serial(async () => {
      if (!this.inspections.delete(inspection))
        return {
          definitionPath: inspection.definitionPath,
          status: "blocked",
          message:
            "Adoption inspection expired or was not issued by this coordinator.",
        };
      return this.perform(inspection.definitionPath, inspection);
    });
  }
  generate(path: string): Promise<ReportResult> {
    return this.serial(() => this.perform(path));
  }
  generateAll(): Promise<readonly ReportResult[]> {
    return this.serial(async () => {
      const paths = (await this.freshDocuments())
        .filter((d) => isDerivedArtefactDefinition(d.frontmatter))
        .map((d) => d.path)
        .sort();
      const results: ReportResult[] = [];
      for (const path of paths) {
        if (this.disposed) {
          results.push({
            definitionPath: path,
            status: "blocked",
            message: "Reports was disabled.",
          });
          continue;
        }
        results.push(await this.perform(path));
      }
      return results;
    });
  }
  private async parents(path: string): Promise<void> {
    let folder = "";
    for (const part of path.split("/").slice(0, -1)) {
      this.active();
      folder = folder ? `${folder}/${part}` : part;
      if (!this.vault.kind(folder)) await this.vault.createFolder(folder);
      else if (this.vault.kind(folder) !== "folder")
        throw new Blocked(`Parent is a file: ${folder}`);
    }
  }
  private async recovery(output: string, content: string): Promise<string> {
    const base = `${output}.murmuration-report-backup`;
    let path = base,
      counter = 1;
    while (this.vault.kind(path)) path = `${base}.${counter++}`;
    this.active();
    await this.vault.create(path, content);
    if ((await this.vault.read(path)) !== content)
      throw new Error(`Recovery copy verification failed: ${path}`);
    return path;
  }
  private async write(
    path: string,
    previous: string | null,
    next: string,
  ): Promise<void> {
    this.active();
    if (previous === null) await this.vault.create(path, next);
    else await this.vault.replace(path, previous, next);
    if ((await this.vault.read(path)) !== next)
      throw new Error(`Write verification failed: ${path}`);
  }
  private async perform(
    path: string,
    adoption?: AdoptionInspection,
  ): Promise<ReportResult> {
    let p: Plan | undefined,
      recoveryPath: string | undefined,
      receiptRecoveryPath: string | undefined,
      outputAttempted = false,
      receiptAttempted = false;
    try {
      p = await this.plan(path);
      const owner = await this.owner(p, !!adoption);
      if (
        adoption &&
        (p.definition.output !== adoption.outputPath ||
          p.output === null ||
          (await digest(p.output)) !== adoption.digest ||
          (await digest(p.snapshots.get(path)!)) !==
            adoption.definitionDigest ||
          owner !== adoption.previousOwner)
      )
        throw new Blocked(
          "Adopted output, definition or ownership changed; inspect again.",
        );
      if (p.output !== null && owner !== path && !adoption)
        throw new Blocked(
          "Ownership needs review. Use Adopt report output; existing assets are preserved.",
        );
      await this.recheck(p);
      await this.parents(p.definition.output);
      await this.recheck(p);
      // Keep a recoverable original for every replacement, including adoption.
      if (p.output !== null && p.output !== p.content) {
        recoveryPath = await this.recovery(p.definition.output, p.output);
        await this.recheck(p);
      }
      const r = serialiseReceipt({
        version: 1,
        definitionPath: path,
        outputPath: p.definition.output,
        digest: await digest(p.content),
      });
      if (p.receipt !== null && p.receipt !== r) {
        receiptRecoveryPath = await this.recovery(
          receiptPath(p.definition.output),
          p.receipt,
        );
        await this.recheck(p);
      }
      if (p.content !== p.output) {
        outputAttempted = true;
        await this.write(p.definition.output, p.output, p.content);
      }
      if ((await this.vault.read(p.definition.output)) !== p.content)
        throw new Blocked("Output changed before receipt write.");
      if (r !== p.receipt) {
        receiptAttempted = true;
        await this.write(receiptPath(p.definition.output), p.receipt, r);
      }
      if (
        (await this.vault.read(p.definition.output)) !== p.content ||
        (await this.vault.read(receiptPath(p.definition.output))) !== r
      )
        throw new Error("Output or receipt changed during verification.");
      this.active();
      const recoveryPaths = [recoveryPath, receiptRecoveryPath].filter(
        (value): value is string => !!value,
      );
      return {
        definitionPath: path,
        outputPath: p.definition.output,
        status:
          p.output === null
            ? "created"
            : p.output === p.content
              ? "unchanged"
              : "replaced",
        observations: p.observations,
        message: `${p.observations} observations; saved output verified.`,
        ...(recoveryPaths.length ? { recoveryPaths } : {}),
      };
    } catch (error) {
      const recovery: string[] = [recoveryPath, receiptRecoveryPath].filter(
        (value): value is string => !!value,
      );
      const details: string[] = [];
      // Best-effort conditional compensation, never overwrite a concurrent edit.
      if (p && (outputAttempted || receiptAttempted)) {
        const pairs: [string, string | null, string][] = [];
        if (receiptAttempted)
          pairs.push([
            receiptPath(p.definition.output),
            p.receipt,
            serialiseReceipt({
              version: 1,
              definitionPath: path,
              outputPath: p.definition.output,
              digest: await digest(p.content),
            }),
          ]);
        if (outputAttempted)
          pairs.push([p.definition.output, p.output, p.content]);
        for (const [target, previous, written] of pairs) {
          try {
            if (
              this.vault.kind(target) === "file" &&
              (await this.vault.read(target)) === written
            ) {
              if (previous === null)
                await this.vault.removeCreated(target, written);
              else await this.vault.replace(target, written, previous);
            }
          } catch (restoreError) {
            details.push(
              `${target}: recovery needed (${errorText(restoreError)})`,
            );
            if (p.output !== null && !recoveryPath) {
              try {
                recoveryPath = await this.recovery(
                  p.definition.output,
                  p.output,
                );
                recovery.push(recoveryPath);
              } catch {
                details.push("Could not create a recovery copy.");
              }
            }
          }
        }
      }
      return {
        definitionPath: path,
        ...(p ? { outputPath: p.definition.output } : {}),
        status: error instanceof Blocked ? "blocked" : "failed",
        message: [errorText(error), ...details].join(" "),
        ...(recovery.length ? { recoveryPaths: recovery } : {}),
      };
    }
  }
}
