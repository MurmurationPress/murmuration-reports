import type { Properties } from "./DefinitionEditing";

export function chartPresentationStatus(frontmatter: Properties): string {
  const presentation = frontmatter.presentation;
  const hasLegacyOptions = ["y_min", "y_max", "caption"].some(
    (key) => frontmatter[key] !== undefined,
  );
  if (presentation === "publication-v2")
    return "Publication v2 presentation is selected in the current definition.";
  if (presentation === "publication")
    return "Publication presentation is selected in the current definition.";
  if (presentation === "legacy" || presentation === undefined)
    return `Legacy presentation is selected in the current definition.${hasLegacyOptions ? " Stored publication fields are preserved but are not active in legacy rendering." : ""}`;
  return `The current definition contains an unrecognized presentation value (${JSON.stringify(presentation)}); the existing parser treats it as legacy. Its stored fields are preserved.`;
}

export const SAVED_CHART_OUTPUT_STATUS =
  "The saved output is a separate asset and may be out of date after definition edits. Its producing presentation is not recorded; the title and filename do not identify it. Generate explicitly to update it.";

export function shouldDescribeSavedChartOutput(
  output: string,
  diagnostics: readonly string[],
): boolean {
  return (
    !!output &&
    !diagnostics.some(
      (diagnostic) =>
        diagnostic.startsWith("Saved output is missing.") ||
        diagnostic.startsWith("Output collision:"),
    )
  );
}
