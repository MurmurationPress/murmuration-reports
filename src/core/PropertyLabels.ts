/** Humanise YAML keys for display without changing the source key. */
export function humanisePropertyKey(key: string): string {
  return key
    .replace(/_/gu, " ")
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/gu, "$1 $2")
    .replace(
      /(^|\s)([a-z])/gu,
      (_match, prefix: string, letter: string) => prefix + letter.toUpperCase(),
    );
}
