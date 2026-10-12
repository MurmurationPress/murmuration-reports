import { App, Modal } from "obsidian";
import {
  AdoptionInspection,
  ReportResult,
} from "../reports/GenerationCoordinator";
export class ResultsModal extends Modal {
  constructor(
    app: App,
    private readonly results: readonly ReportResult[],
  ) {
    super(app);
  }
  onOpen(): void {
    this.contentEl.createEl("h2", { text: "Report generation results" });
    if (!this.results.length)
      this.contentEl.createEl("p", {
        text: "No report definitions were found.",
      });
    for (const result of this.results) {
      const row = this.contentEl.createEl("section");
      row.createEl("h3", { text: result.definitionPath });
      row.createEl("p", { text: `${result.status}: ${result.message}` });
      if (result.outputPath)
        row.createEl("p", { text: `Output: ${result.outputPath}` });
      for (const path of result.recoveryPaths ?? [])
        row.createEl("p", { text: `Recovery copy: ${path}` });
    }
    const close = this.contentEl.createEl("button", { text: "Close" });
    close.addEventListener("click", () => this.close());
    close.focus();
  }
  onClose(): void {
    this.contentEl.empty();
  }
}
export class AdoptionModal extends Modal {
  private accepted = false;
  constructor(
    app: App,
    private readonly inspection: AdoptionInspection,
    private readonly finish: (accepted: boolean) => void,
  ) {
    super(app);
  }
  onOpen(): void {
    this.contentEl.createEl("h2", { text: "Adopt output and generate" });
    this.contentEl.createEl("p", {
      text: `Definition: ${this.inspection.definitionPath}`,
    });
    this.contentEl.createEl("p", {
      text: `Output: ${this.inspection.outputPath}`,
    });
    this.contentEl.createEl("p", {
      text: `Inspected SHA-256: ${this.inspection.digest}`,
    });
    if (this.inspection.previousOwner)
      this.contentEl.createEl("p", {
        text: `Former owner: ${this.inspection.previousOwner}. Its definition must remain absent.`,
      });
    this.contentEl.createEl("p", {
      text: "This adopts the exact inspected file and regenerates it. A recovery copy is kept before replacement. Changes made while this dialog is open cancel adoption.",
    });
    const details = this.contentEl.createEl("details");
    details.createEl("summary", { text: "Inspect existing file content" });
    details.createEl("pre", { text: this.inspection.content });
    const open = this.contentEl.createEl("button", {
      text: "Open existing output",
    });
    open.addEventListener("click", () => {
      void this.app.workspace.openLinkText(
        this.inspection.outputPath,
        "",
        true,
      );
    });
    const confirm = this.contentEl.createEl("button", {
      text: "Adopt and generate",
    });
    confirm.addEventListener("click", () => {
      this.accepted = true;
      this.close();
    });
    const cancel = this.contentEl.createEl("button", { text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    cancel.focus();
  }
  onClose(): void {
    this.contentEl.empty();
    this.finish(this.accepted);
  }
}
