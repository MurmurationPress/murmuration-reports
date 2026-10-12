/** Additional mutation safety; the extracted definition schema is unchanged. */
export function safePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    !!path &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !/[\x00-\x1f<>:"|?*]/.test(path) &&
    path
      .split("/")
      .every(
        (segment) =>
          !!segment &&
          segment !== "." &&
          segment !== ".." &&
          segment === segment.trim() &&
          !segment.endsWith(".") &&
          !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment),
      )
  );
}

/** Fail closed on ambiguous portable destinations; never rewrite author paths. */
export const pathKey = (path: string): string =>
  path.normalize("NFC").toLowerCase();
export const within = (path: string, folder: string): boolean =>
  pathKey(path) === pathKey(folder) ||
  pathKey(path).startsWith(pathKey(folder) + "/");
