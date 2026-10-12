import {
  App,
  getFrontMatterInfo,
  parseYaml,
  TFile,
  EventRef,
  TAbstractFile,
} from "obsidian";
import { ReportVault } from "../reports/GenerationCoordinator";
import { validateSvgAdoption } from "./AssetValidation";
import { pathKey } from "../reports/PathSafety";
export function reportVault(
  app: App,
  registerEvent?: (ref: EventRef) => void,
): ReportVault {
  const versions = new Map<string, number>();
  const changed = (path: string) =>
    versions.set(pathKey(path), (versions.get(pathKey(path)) ?? 0) + 1);
  // These events only invalidate write guards. They never invoke generation.
  if (registerEvent && typeof app.vault.on === "function") {
    const onChange = (file: TAbstractFile) => {
      if (file instanceof TFile && file.extension === "md") changed(file.path);
    };
    registerEvent(app.vault.on("create", onChange));
    registerEvent(app.vault.on("modify", onChange));
    registerEvent(app.vault.on("delete", onChange));
    registerEvent(
      app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFile && file.extension === "md") {
          changed(oldPath);
          changed(file.path);
        }
      }),
    );
  }
  const file = (path: string): TFile => {
    const value = app.vault.getAbstractFileByPath(path);
    if (!(value instanceof TFile))
      throw new Error(`${path} is missing or is not a file.`);
    return value;
  };
  return {
    version: (path) => versions.get(pathKey(path)) ?? 0,
    validateAdoptionContent: (content, type) => {
      if (type === "line-chart") validateSvgAdoption(content);
    },
    documents: () =>
      app.vault.getMarkdownFiles().map((f) => ({
        path: f.path,
        frontmatter: app.metadataCache.getFileCache(f)?.frontmatter,
      })),
    readDocument: async (path) => {
      const raw = await app.vault.read(file(path));
      const info = getFrontMatterInfo(raw);
      const parsed: unknown =
        (info.exists ? parseYaml(info.frontmatter) : {}) ?? {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error(`${path}: frontmatter must be a mapping.`);
      return { path, frontmatter: parsed as Record<string, unknown> };
    },
    kind: (path) => {
      const entry = app.vault.getAbstractFileByPath(path);
      return entry ? (entry instanceof TFile ? "file" : "folder") : null;
    },
    read: (path) => app.vault.read(file(path)),
    create: async (path, content, guard) => {
      if (
        app.vault.getAbstractFileByPath(path) ||
        (await app.vault.adapter.exists(path))
      )
        throw new Error(`${path} already exists on disk or in the vault.`);
      guard?.();
      await app.vault.create(path, content);
    },
    replace: async (path, expected, content, guard) => {
      await app.vault.process(file(path), (raw) => {
        guard?.();
        if (raw !== expected)
          throw new Error(`${path} changed before replacement.`);
        return content;
      });
    },
    createFolder: async (path) => {
      await app.vault.createFolder(path);
    },
  };
}
