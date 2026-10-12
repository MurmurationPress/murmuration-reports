import { App, getFrontMatterInfo, parseYaml, TFile } from "obsidian";
import { ReportVault } from "../reports/GenerationCoordinator";
export function reportVault(app: App): ReportVault {
  const file = (path: string): TFile => {
    const value = app.vault.getAbstractFileByPath(path);
    if (!(value instanceof TFile))
      throw new Error(`${path} is missing or is not a file.`);
    return value;
  };
  return {
    documents: () =>
      app.vault
        .getMarkdownFiles()
        .map((f) => ({
          path: f.path,
          frontmatter: app.metadataCache.getFileCache(f)?.frontmatter,
        })),
    readDocument: async (path) => {
      const raw = await app.vault.read(file(path));
      const info = getFrontMatterInfo(raw);
      const parsed: unknown = info.exists ? parseYaml(info.frontmatter) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error(`${path}: frontmatter must be a mapping.`);
      return { path, frontmatter: parsed as Record<string, unknown> };
    },
    kind: (path) => {
      const entry = app.vault.getAbstractFileByPath(path);
      return entry ? (entry instanceof TFile ? "file" : "folder") : null;
    },
    read: (path) => app.vault.read(file(path)),
    create: async (path, content) => {
      await app.vault.create(path, content);
    },
    replace: async (path, expected, content) => {
      await app.vault.process(file(path), (raw) => {
        if (raw !== expected)
          throw new Error(`${path} changed before replacement.`);
        return content;
      });
    },
    removeCreated: async (path, expected) => {
      // There is no compare-and-delete API: recheck immediately before removal.
      const target = file(path);
      if ((await app.vault.read(target)) !== expected)
        throw new Error(`${path} changed before recovery cleanup.`);
      await app.vault.delete(target);
    },
    createFolder: async (path) => {
      await app.vault.createFolder(path);
    },
  };
}
