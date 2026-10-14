import { ItemView, WorkspaceLeaf, TFile, Notice, Modal } from "obsidian";
import { ManagerService, DefinitionDraft } from "./ManagerService";
import { ReportEntry } from "./ReportCatalogue";
import { AdoptionModal } from "../ui/ReportInteractions";
import { Properties, readEditable } from "./DefinitionEditing";
import { humanisePropertyKey } from "../core/PropertyLabels";
import { DiscoveredProperty } from "../core/PropertyDiscovery";
import {
  chartPresentationStatus,
  SAVED_CHART_OUTPUT_STATUS,
} from "./PresentationStatus";
export const REPORTS_VIEW = "murmuration-reports-manager";
const readEditableSafeOriginal = (draft: DefinitionDraft): Properties =>
  draft.original === null ? {} : readEditable(draft.original).data;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export class ReportsView extends ItemView {
  private instanceId = Math.random().toString(36).slice(2);
  private previewStates = new Map<string, string>();
  private previewTimer?: ReturnType<typeof setTimeout>;
  private previewUrl?: string;
  private selectedSignature = "";
  private selected: string | null = null;
  private search = "";
  private typeFilter = "all";
  private statusFilter = "all";
  private list!: HTMLElement;
  private details!: HTMLElement;
  private previewEl?: HTMLElement;
  private unsubscribe?: () => void;
  private unfiles?: () => void;
  private revision = 0;
  private uiClosed = false;
  private editing = false;
  private drafts = new Map<string, DefinitionDraft>();
  private editorKey: string | null = null;
  private editorGeneration = 0;
  private discoveryGeneration = 0;
  private discoveryTimer?: ReturnType<typeof setTimeout>;
  private dialogs = new Set<Modal>();
  private busy = false;
  private actionFocus?: HTMLElement;
  private mutationButtons = new Set([
    "Generate",
    "Generate all",
    "Save definition",
    "Save and generate",
    "Inspect adoption / repair",
  ]);
  private setBusy(value: boolean) {
    this.busy = value;
    if (this.uiClosed) return;
    if (value)
      this.actionFocus = this.contentEl.ownerDocument
        .activeElement as HTMLElement;
    this.contentEl.setAttribute("aria-busy", String(value));
    for (const button of Array.from(this.contentEl.querySelectorAll("button")))
      if (this.mutationButtons.has(button.textContent ?? ""))
        button.disabled = value;
    let status = this.contentEl.querySelector(
      ".mr-working",
    ) as HTMLElement | null;
    if (value && !status)
      status = this.contentEl.createEl("p", {
        cls: "mr-working",
        attr: { role: "status" },
      });
    if (status) status.textContent = value ? "Report action in progress…" : "";
    if (
      !value &&
      this.actionFocus?.isConnected &&
      this.contentEl.ownerDocument.activeElement ===
        this.contentEl.ownerDocument.body
    )
      this.actionFocus.focus();
  }
  private batchEl?: HTMLElement;
  constructor(
    leaf: WorkspaceLeaf,
    private service: ManagerService,
  ) {
    super(leaf);
  }
  getViewType() {
    return REPORTS_VIEW;
  }
  getDisplayText() {
    return "Reports";
  }
  getIcon() {
    return "bar-chart-3";
  }
  async onOpen() {
    this.uiClosed = false;
    const root = this.contentEl;
    root.empty();
    root.addClass("murmuration-reports-manager");
    const toolbar = root.createDiv({ cls: "mr-toolbar" });
    toolbar.createEl("h2", { text: "Reports" });
    this.button(toolbar, "Create report", () => this.create());
    this.button(toolbar, "Generate all", () => this.generate());
    this.button(toolbar, "Refresh", () => {
      this.service.catalogue.reset();
      void this.loadPreview();
    });
    const filters = root.createDiv({ cls: "mr-filters" });
    const search = filters.createEl("input", {
      type: "search",
      attr: {
        "aria-label": "Search reports",
        placeholder: "Search report names",
      },
    });
    search.value = this.search;
    search.addEventListener("input", () => {
      this.search = search.value;
      this.renderList();
    });
    const type = this.select(
      filters,
      "Report type",
      [
        ["all", "All types"],
        ["line-chart", "Charts"],
        ["state-table", "State tables"],
      ],
      this.typeFilter,
    );
    type.addEventListener("change", () => {
      this.typeFilter = type.value;
      this.renderList();
    });
    const status = this.select(
      filters,
      "Report status",
      [
        ["all", "All statuses"],
        ["ready", "Saved output present"],
        ["missing-output", "Missing output"],
        ["missing-source", "Missing source"],
        ["invalid", "Invalid definition"],
        ["collision", "Collision"],
        ["unverified", "Unverified ownership (inspected)"],
        ["failed", "Failed generation"],
        ["problem", "Problems and failed attempts"],
      ],
      this.statusFilter,
    );
    status.addEventListener("change", () => {
      this.statusFilter = status.value;
      this.renderList();
    });
    this.batchEl = root.createDiv({
      cls: "mr-batch",
      attr: { "aria-live": "polite" },
    });
    const panes = root.createDiv({ cls: "mr-panes" });
    this.list = panes.createDiv({
      cls: "mr-list",
      attr: { "aria-label": "Report list" },
    });
    this.details = panes.createDiv({ cls: "mr-details" });
    this.unsubscribe = this.service.catalogue.subscribe(() => {
      if (this.uiClosed) return;
      this.renderList();
      this.refreshDiagnostics();
      const signature = JSON.stringify(this.entry()?.frontmatter);
      if (!this.editing && signature !== this.selectedSignature)
        this.showSelected();
    });
    this.unfiles = this.service.onFileChange((path, old) => {
      if (this.uiClosed) return;
      if (old && this.selected === old) {
        this.selected = path;
        if (this.drafts.has(old)) {
          const draft = this.drafts.get(old)!;
          draft.conflict =
            "The definition moved. Your draft remains bound to its old path. Reload the moved definition or reconcile explicitly.";
          this.drafts.set(path, draft);
          this.drafts.delete(old);
          if (this.editorKey === old) this.editorKey = path;
        }
        this.renderList();
        this.refreshDiagnostics();
        if (!this.editing) this.showSelected();
      }
      const entry = this.entry();
      if (
        entry &&
        (path === entry.output ||
          path === entry.output + ".murmuration-report.json" ||
          path === entry.path ||
          old === entry.path)
      ) {
        if (this.editing && path === entry.path) {
          const draft = this.drafts.get(this.editorKey!);
          if (draft && draft.path === entry.path)
            draft.conflict =
              "The definition changed externally. Your draft is retained until reload or reconciliation.";
          this.refreshDiagnostics();
        }
        if (!this.editing) this.queuePreview();
      }
    });
    this.renderList();
    this.showSelected();
  }
  private button(parent: HTMLElement, label: string, action: () => unknown) {
    const b = parent.createEl("button", { text: label });
    if (this.mutationButtons.has(label)) b.disabled = this.busy;
    b.addEventListener("click", () => {
      void action();
    });
    return b;
  }
  private select(
    parent: HTMLElement,
    label: string,
    options: string[][],
    value: string,
  ) {
    const wrap = parent.createEl("label", { cls: "mr-field" });
    wrap.createSpan({ text: label });
    const el = wrap.createEl("select", { attr: { "aria-label": label } });
    el.addEventListener("change", () => el.removeAttribute("aria-invalid"));
    for (const [v, text] of options) el.createEl("option", { value: v, text });
    el.value = value;
    return el;
  }
  private entry() {
    return this.service.catalogue
      .entries()
      .find((e) => e.path === this.selected);
  }
  private renderList() {
    if (!this.list) return;
    this.batchEl?.empty();
    if (this.service.catalogue.outcomes.size) {
      this.batchEl?.createEl("strong", {
        text: "Generation results (this session)",
      });
      for (const [path, result] of this.service.catalogue.outcomes)
        this.batchEl?.createEl("p", {
          text: path + " — " + result.status + ": " + result.message,
        });
    }
    const active = this.list.ownerDocument.activeElement as HTMLElement | null;
    const focused = active?.dataset.report;
    this.list.empty();
    const entries = this.service.catalogue.entries();
    const filtered = entries.filter(
      (e) =>
        e.name.toLowerCase().includes(this.search.toLowerCase()) &&
        (this.typeFilter === "all" || e.type === this.typeFilter) &&
        (this.statusFilter === "all" ||
          e.status === this.statusFilter ||
          (this.statusFilter === "unverified" &&
            this.previewStates.get(e.path) === "unverified") ||
          (this.statusFilter === "failed" &&
            ["blocked", "failed"].includes(
              this.service.catalogue.outcomes.get(e.path)?.status ?? "",
            )) ||
          (this.statusFilter === "problem" &&
            (e.diagnostics.length ||
              ["unverified", "error"].includes(
                this.previewStates.get(e.path) ?? "",
              ) ||
              ["blocked", "failed"].includes(
                this.service.catalogue.outcomes.get(e.path)?.status ?? "",
              )))),
    );
    if (!entries.length)
      this.list.createEl("p", {
        text: "No reports yet. Create a chart or state table from an existing dataset folder.",
      });
    else if (!filtered.length)
      this.list.createEl("p", { text: "No reports match these filters." });
    for (const e of filtered) {
      const b = this.button(this.list, e.name, () => {
        this.selected = e.path;
        this.showSelected();
        this.renderList();
      });
      b.dataset.report = e.path;
      b.setAttribute("aria-pressed", String(this.selected === e.path));
      b.createEl("small", { text: e.path });
      b.createEl("small", {
        text:
          (e.type === "line-chart"
            ? "Chart"
            : e.type === "state-table"
              ? "State table"
              : "Unknown type") +
          " · " +
          (this.service.catalogue.outcomes.get(e.path)?.status ?? e.status),
      });
      if (focused === e.path) b.focus();
    }
  }
  private refreshDiagnostics() {
    const el = this.details?.querySelector(
      ".mr-diagnostics",
    ) as HTMLElement | null;
    if (!el) return;
    el.empty();
    const e = this.entry();
    if (e) for (const d of e.diagnostics) el.createEl("p", { text: d });
    const outcome = this.selected
      ? this.service.catalogue.outcomes.get(this.selected)
      : undefined;
    if (outcome)
      el.createEl("p", {
        text:
          "Last explicit attempt — " + outcome.status + ": " + outcome.message,
      });
    const draft = this.editorKey ? this.drafts.get(this.editorKey) : undefined;
    if (draft?.conflict) el.createEl("p", { text: draft.conflict });
  }
  private clearPreview() {
    this.revision++;
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = undefined;
    }
    this.previewEl?.empty();
  }
  private showSelected() {
    this.editorGeneration++;
    this.discoveryGeneration++;
    if (this.discoveryTimer !== undefined) {
      clearTimeout(this.discoveryTimer);
      this.discoveryTimer = undefined;
    }
    this.clearPreview();
    this.editing = false;
    this.editorKey = null;
    this.details.empty();
    const e = this.entry();
    this.selectedSignature = JSON.stringify(e?.frontmatter);
    if (!e) {
      this.details.createEl("p", {
        text: "Select a report to inspect its saved output, edit its definition or generate it.",
      });
      return;
    }
    this.details.createEl("h3", { text: e.name });
    this.details.createEl("p", { text: e.path });
    this.details.createEl("p", {
      text: "Dataset: " + (e.source || "Not specified"),
    });
    this.details.createEl("p", {
      text: "Output: " + (e.output || "Not specified"),
    });
    if (e.type === "line-chart") {
      this.details.createEl("p", {
        cls: "mr-presentation-status",
        text: chartPresentationStatus(e.frontmatter),
      });
      this.details.createEl("p", {
        cls: "mr-saved-output-note",
        text: SAVED_CHART_OUTPUT_STATUS,
      });
    }
    const actions = this.details.createDiv({ cls: "mr-actions" });
    this.button(actions, "Edit definition", () => this.edit(e.path));
    this.button(actions, "Generate", () => this.generate(e.path));
    this.button(actions, "Open definition", () => this.openFile(e.path));
    this.button(actions, "Open dataset folder", () =>
      this.openFolder(e.source),
    );
    this.button(actions, "Open output", () => this.openFile(e.output));
    this.button(actions, "Inspect adoption / repair", () => this.adopt(e.path));
    this.details.createDiv({
      cls: "mr-diagnostics",
      attr: { "aria-live": "polite" },
    });
    this.refreshDiagnostics();
    this.previewEl = this.details.createDiv({
      cls: "mr-preview",
      attr: { "aria-live": "polite" },
    });
    void this.loadPreview();
  }
  private queuePreview() {
    this.clearPreview();
    if (this.previewTimer !== undefined) return;
    this.previewTimer = setTimeout(() => {
      this.previewTimer = undefined;
      void this.loadPreview();
    }, 80);
  }
  private async loadPreview() {
    if (this.previewTimer !== undefined) {
      clearTimeout(this.previewTimer);
      this.previewTimer = undefined;
    }
    const e = this.entry(),
      el = this.previewEl;
    if (!e || !el || this.editing || this.uiClosed) return;
    this.clearPreview();
    const revision = this.revision;
    el.createEl("p", { text: "Checking saved output…" });
    const result = await this.service.preview(e);
    if (this.uiClosed || this.editing || revision !== this.revision) return;
    el.empty();
    this.previewStates.set(e.path, result.state);
    this.renderList();
    el.createEl("p", { text: result.message });
    if (result.state === "available") {
      if (e.type === "line-chart") {
        const file = this.service.app.vault.getAbstractFileByPath(e.output);
        if (file instanceof TFile) {
          this.previewUrl = URL.createObjectURL(
            new Blob([result.content!], { type: "image/svg+xml" }),
          );
          const img = el.createEl("img", {
            attr: { alt: e.name, src: this.previewUrl },
          });
          img.addEventListener("error", () => {
            if (!this.uiClosed && revision === this.revision)
              el.createEl("p", {
                text: "The saved chart could not be displayed. Open output to inspect it.",
              });
          });
        }
      } else {
        try {
          renderSavedTable(result.content!, el);
        } catch (error) {
          el.createEl("p", { text: "Preview failed: " + message(error) });
        }
      }
    }
  }
  private async openFile(path: string) {
    const file = this.service.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile)
      await this.service.app.workspace.getLeaf("tab").openFile(file);
    else new Notice("That file is missing.");
  }
  private async openFolder(path: string) {
    const folder = this.service.app.vault.getAbstractFileByPath(path);
    if (!folder) {
      new Notice("Dataset folder is missing.");
      return;
    }
    const leaf = this.service.app.workspace.getLeavesOfType("file-explorer")[0];
    if (leaf) {
      await this.service.app.workspace.revealLeaf(leaf);
      const explorer = leaf.view as unknown as {
        revealInFolder?: (file: unknown) => Promise<void>;
      };
      if (explorer.revealInFolder) await explorer.revealInFolder(folder);
      else new Notice("Open " + path + " in the file explorer.");
    } else new Notice("Open " + path + " in the file explorer.");
  }
  private async generate(path?: string) {
    if (this.busy || this.uiClosed) return;
    this.setBusy(true);
    try {
      await this.service.generate(path);
      if (!this.uiClosed) {
        this.refreshDiagnostics();
        await this.loadPreview();
      }
    } catch (e) {
      if (!this.uiClosed) new Notice(message(e));
    } finally {
      this.setBusy(false);
    }
  }
  private async adopt(path: string) {
    if (this.busy || this.uiClosed) return;
    this.setBusy(true);
    try {
      const inspection = await this.service.coordinator.inspectAdoption(path);
      if (this.uiClosed) return;
      const accepted = await new Promise<boolean>((resolve) => {
        const modal = new AdoptionModal(
          this.service.app,
          inspection,
          (value) => {
            this.dialogs.delete(modal);
            resolve(value);
          },
        );
        this.dialogs.add(modal);
        modal.open();
      });
      if (accepted && !this.uiClosed) {
        this.service.record(
          await this.service.coordinator.adoptAndGenerate(inspection),
        );
        await this.loadPreview();
      }
    } catch (error) {
      if (!this.uiClosed) new Notice(message(error));
    } finally {
      this.setBusy(false);
    }
  }
  private create() {
    const key = ":new:";
    let draft = this.drafts.get(key);
    if (!draft) {
      draft = {
        path: "Reports/Definitions/Untitled report.md",
        original: null,
        values: {
          world_entity: "derived-artefact",
          artefact_type: "line-chart",
          title: "Untitled report",
          source: "",
          x: "date",
          series: [{ property: "", label: "" }],
          output: "Reports/Outputs/Untitled report.svg",
          presentation: "publication-v2",
        },
      };
      this.drafts.set(key, draft);
    }
    this.showEditor(key, draft);
  }
  private async edit(path: string) {
    try {
      const draft = this.drafts.get(path) ?? (await this.service.draft(path));
      if (this.uiClosed) return;
      this.drafts.set(path, draft);
      this.showEditor(path, draft);
    } catch (e) {
      if (this.uiClosed) return;
      this.details.createEl("p", { text: message(e) });
      this.button(this.details, "Open definition", () => this.openFile(path));
    }
  }
  private showEditor(key: string, draft: DefinitionDraft, focusField?: string) {
    const editorGeneration = ++this.editorGeneration;
    this.discoveryGeneration++;
    if (this.discoveryTimer !== undefined) {
      clearTimeout(this.discoveryTimer);
      this.discoveryTimer = undefined;
    }
    this.clearPreview();
    this.editing = true;
    this.editorKey = key;
    this.details.empty();
    this.details.createEl("h3", {
      text: draft.original === null ? "Create report" : "Edit definition",
    });
    const form = this.details.createEl("form");
    form.addEventListener("submit", (e) => e.preventDefault());
    const input = (
      label: string,
      value: string,
      change: (v: string) => void,
      type = "text",
    ) => {
      const wrap = form.createEl("label", { cls: "mr-field" });
      wrap.createSpan({ text: label });
      const el = wrap.createEl("input", { type, value });
      el.addEventListener("input", () => {
        el.removeAttribute("aria-invalid");
        change(el.value);
      });
      return el;
    };
    const titleGroup = form.createDiv({ cls: "mr-chart-title-control" });
    titleGroup.createEl("p", {
      text: "This title also names the report in the manager. The definition and output destinations are configured separately below.",
      cls: "mr-muted-note",
    });
    const groups = {
      data: form.createEl("fieldset", { cls: "mr-editor-group" }),
      axes: form.createEl("fieldset", { cls: "mr-editor-group" }),
      appearance: form.createEl("fieldset", { cls: "mr-editor-group" }),
      publication: form.createEl("fieldset", { cls: "mr-editor-group" }),
      output: form.createEl("fieldset", { cls: "mr-editor-group" }),
    };
    for (const [key, title] of [
      [
        "data",
        "Data — X property (independent variable) and Y series (dependent variables)",
      ],
      ["axes", "Axes"],
      ["appearance", "Appearance"],
      ["publication", "Publication"],
      ["output", "Output and definition"],
    ] as const)
      groups[key].createEl("legend", { text: title });
    const touched = (draft.manualDestinations ??= {
      definition: draft.original !== null,
      output: draft.original !== null,
    });
    const type = this.select(
      form,
      "Report type",
      [
        ["line-chart", "Chart"],
        ["state-table", "State table"],
      ],
      String(draft.values.artefact_type),
    );
    type.disabled = draft.original !== null;
    type.addEventListener("change", () => {
      draft.values.artefact_type = type.value;
      if (type.value === "state-table") {
        draft.values.parameters = [{ property: "", label: "" }];
        delete draft.values.series;
      } else {
        draft.values.series = [{ property: "", label: "" }];
        delete draft.values.parameters;
      }
      if (!touched.output)
        draft.values.output =
          "Reports/Outputs/" +
          String(draft.values.title) +
          (type.value === "line-chart" ? ".svg" : ".md");
      this.showEditor(key, draft, "Report type");
    });
    const name = input(
      draft.values.artefact_type === "line-chart"
        ? "Chart title / report name"
        : "Report name",
      String(draft.values.title ?? ""),
      (v) => {
        draft.values.title = v;
        if (draft.original === null) {
          const basename = v.trim();
          if (!touched.definition) {
            draft.path = "Reports/Definitions/" + basename + ".md";
            destination.value = draft.path;
          }
          if (!touched.output) {
            draft.values.output =
              "Reports/Outputs/" +
              basename +
              (draft.values.artefact_type === "line-chart" ? ".svg" : ".md");
            output.value = String(draft.values.output);
          }
        }
      },
    );
    titleGroup.insertBefore(name.parentElement!, titleGroup.firstChild);
    const destination = input("Definition destination", draft.path, (v) => {
      touched.definition = true;
      draft.path = v;
    });
    destination.disabled = draft.original !== null;
    const source = input(
      "Dataset folder",
      String(draft.values.source ?? ""),
      (v) => (draft.values.source = v),
    );
    const folderList = form.createEl("datalist", {
      attr: { id: "mr-folders-" + this.instanceId },
    });
    for (const folder of this.service.folders())
      folderList.createEl("option", { value: folder });
    source.setAttribute("list", folderList.id);
    form.createEl("p", {
      text: "Property choices inspect the full recursive dataset. Values are never coerced; generation performs fresh whole-source validation.",
    });
    const date = input(
      "X property (independent variable; currently ISO date)",
      String(draft.values.x ?? ""),
      (v) => (draft.values.x = v),
    );
    const propertyList = form.createEl("datalist", {
      attr: { id: "mr-properties-" + this.instanceId },
    });
    const numericList = form.createEl("datalist", {
      attr: { id: "mr-numeric-" + this.instanceId },
    });
    date.setAttribute("list", propertyList.id);
    date.placeholder = "Search by display name or exact key";
    const discoveryPanel = form.createDiv({ cls: "mr-property-discovery" });
    const discoveryStatus = discoveryPanel.createEl("p", {
      cls: "mr-property-discovery-status",
      attr: { role: "status", "aria-live": "polite" },
    });
    const propertyDetails = discoveryPanel.createEl("details", {
      cls: "mr-property-details",
    });
    propertyDetails.createEl("summary", { text: "Property details" });
    const propertyTable = propertyDetails.createEl("table", {
      cls: "mr-property-table",
    });
    const propertyTableHead = propertyTable.createEl("thead").createEl("tr");
    for (const header of [
      "Display name",
      "Exact key",
      "Observed type",
      "Missing",
      "Suitability",
      "Diagnostics",
    ])
      propertyTableHead.createEl("th", { text: header, attr: { scope: "col" } });
    const propertyTableBody = propertyTable.createEl("tbody");
    let loadProperties: (sourceValue: string) => Promise<void> = async () => {};
    let lastAutoDiscoveryFolder: string | undefined;
    const refreshPropertiesButton = this.button(
      discoveryPanel,
      "Refresh properties",
      () => void loadProperties(String(draft.values.source ?? "").trim()),
    );
    const field =
      draft.values.artefact_type === "line-chart" ? "series" : "parameters";
    const rows = Array.isArray(draft.values[field])
      ? (draft.values[field] as Properties[])
      : [];
    const generatedLabels = (draft.generatedLabels ??= new Map());
    const fields = form.createDiv({ cls: "mr-series" });
    const labelFields = form.createDiv({ cls: "mr-series-labels" });
    let updateConfiguredStatus = () => {};
    let addButton: HTMLButtonElement | undefined;
    const focusRow = (index: number) => {
      if (index < 0) {
        addButton?.focus();
        return;
      }
      const prefix = field === "series" ? "Y series property " : "Parameter property ";
      const control = fields.querySelector<HTMLInputElement>(
        `input[aria-label="${prefix}${index + 1}"]`,
      );
      (control ?? addButton)?.focus();
    };
    const renderRows = () => {
      fields.empty();
      labelFields.empty();
      rows.forEach((row, i) => {
        const group = fields.createDiv({ cls: "mr-series-row" });
        group.createEl("strong", {
          text: (field === "series" ? "Series " : "Parameter ") + (i + 1),
        });
        const labelGroup = labelFields.createDiv({ cls: "mr-series-row" });
        labelGroup.createEl("strong", {
          text:
            (field === "series" ? "Series label " : "Parameter label ") +
            (i + 1),
        });
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          group.createEl("p", {
            text: "This entry is not a mapping. Open definition to repair it, or explicitly remove it.",
          });
          labelGroup.createEl("p", {
            text: "Invalid entry; repair or remove it in Data.",
          });
          this.button(group, "Remove invalid entry", () => {
            rows.splice(i, 1);
            renderRows();
            focusRow(Math.min(i, rows.length - 1));
          });
          return;
        }
        const propertyControl = group.createEl("input", {
          value: String(row.property ?? ""),
          attr: {
            "aria-label":
              (field === "series"
                ? "Y series property "
                : "Parameter property ") +
              (i + 1),
            list: field === "series" ? numericList.id : propertyList.id,
          },
        });
        propertyControl.placeholder = "Search display name or exact key";
        group.createEl("small", {
          cls: "mr-configured-property-status",
          attr: { "aria-live": "polite", "data-property-index": String(i) },
        });
        const labelControl = labelGroup.createEl("input", {
          value: String(row.label ?? ""),
          attr: {
            "aria-label":
              (field === "series" ? "Series label " : "Parameter label ") +
              (i + 1),
          },
        });
        propertyControl.addEventListener("input", () => {
          propertyControl.removeAttribute("aria-invalid");
          row.property = propertyControl.value;
          let generated = generatedLabels.get(row);
          if (!generated && !row.label) {
            row.label = humanisePropertyKey(propertyControl.value);
            generated = { value: String(row.label), overridden: false };
            generatedLabels.set(row, generated);
          } else if (generated && !generated.overridden) {
            row.label = humanisePropertyKey(propertyControl.value);
            generated.value = String(row.label);
          }
          if (!generated?.overridden)
            labelControl.value = String(row.label ?? "");
          updateConfiguredStatus();
        });
        labelControl.addEventListener("input", () => {
          labelControl.removeAttribute("aria-invalid");
          row.label = labelControl.value;
          const generated = generatedLabels.get(row);
          if (generated) generated.overridden = true;
        });
        if (i)
          this.button(group, "Move up", () => {
            [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]];
            renderRows();
            focusRow(i - 1);
          });
        this.button(group, "Remove", () => {
          rows.splice(i, 1);
          renderRows();
          focusRow(Math.min(i, rows.length - 1));
        });
      });
    };
    draft.values[field] = rows;
    renderRows();
    let discoveredProperties: DiscoveredProperty[] | undefined;
    const xStatus = date.parentElement!.createEl("small", {
      cls: "mr-configured-property-status",
      attr: { "aria-live": "polite" },
    });
    const numericSuitable = (property: DiscoveredProperty) =>
      property.types.length === 1 &&
      property.types[0] === "number" &&
      property.missing === 0 &&
      property.invalid.length === 0;
    const dateSuitable = (property: DiscoveredProperty) =>
      property.types.length === 1 &&
      property.types[0] === "date/string" &&
      property.missing === 0;
    const optionLabel = (property: DiscoveredProperty) =>
      `${property.label} — ${property.key} (${property.types.join(" / ") || "no values"}; ${property.missing} missing; date-X ${dateSuitable(property) ? "suitable" : "check values"}; numeric Y ${numericSuitable(property) ? "suitable" : "not suitable"})`;
    const configuredStatus = (
      propertyKey: string,
      suitability: "date" | "numeric" | "any",
    ) => {
      if (!propertyKey) return "Choose a property.";
      if (!discoveredProperties)
        return `“${propertyKey}” is retained; discovery is not current for this folder.`;
      const property = discoveredProperties.find((item) => item.key === propertyKey);
      if (!property)
        return `“${propertyKey}” is not present in the current dataset; the configured value is retained.`;
      if (suitability === "any")
        return `${property.label} — ${property.key} (${property.types.join(" / ") || "no values"}; ${property.missing} missing) is retained for this table parameter.`;
      const suitable = suitability === "date" ? dateSuitable(property) : numericSuitable(property);
      if (suitable)
        return `${property.label} — ${property.key} (${property.types.join(" / ")}) is suitable for ${suitability === "date" ? "date X" : "numeric Y"}.`;
      return `${property.label} — ${property.key} is not currently suitable for ${suitability === "date" ? "date X" : "numeric Y"}: ${property.types.join(" / ") || "no values"}; ${property.missing} missing; ${property.invalid.length} invalid. The configured key is retained.`;
    };
    updateConfiguredStatus = () => {
      xStatus.textContent = configuredStatus(String(draft.values.x ?? ""), "date");
      for (const [index, row] of rows.entries()) {
        const status = fields.querySelector<HTMLElement>(
          `.mr-configured-property-status[data-property-index="${index}"]`,
        );
        if (status && row && typeof row === "object")
          status.textContent = configuredStatus(
            String(row.property ?? ""),
            field === "series" ? "numeric" : "any",
          );
      }
    };
    date.addEventListener("input", updateConfiguredStatus);
    const showManualOptions = (properties: readonly DiscoveredProperty[]) => {
      const keys = new Set(properties.map((property) => property.key));
      if (draft.values.x && !keys.has(String(draft.values.x))) {
        const option = propertyList.createEl("option", { value: String(draft.values.x) });
        option.label = `Currently configured — ${humanisePropertyKey(String(draft.values.x))} — ${String(draft.values.x)} (not found in this dataset)`;
      }
      if (field === "series") {
        for (const row of rows) {
          const key = String(row?.property ?? "");
          const property = properties.find((item) => item.key === key);
          if (key && (!property || !numericSuitable(property))) {
            const option = numericList.createEl("option", { value: key });
            option.label = property
              ? `Currently configured — ${property.label} — ${key} (${property.types.join(" / ") || "no values"}; ${property.missing} missing; incompatible with numeric Y)`
              : `Currently configured — ${humanisePropertyKey(key)} — ${key} (not found in this dataset)`;
          }
        }
      } else {
        for (const row of rows) {
          const key = String(row?.property ?? "");
          if (key && !keys.has(key)) {
            const option = propertyList.createEl("option", { value: key });
            option.label = `Currently configured — ${humanisePropertyKey(key)} — ${key} (not found in this dataset)`;
          }
        }
      }
    };
    const updatePropertyPanel = (
      properties: readonly DiscoveredProperty[] | undefined,
      state: string,
    ) => {
      propertyList.empty();
      numericList.empty();
      propertyTableBody.empty();
      if (properties) {
        for (const property of properties) {
          const label = optionLabel(property);
          const xOption = propertyList.createEl("option", { value: property.key });
          xOption.label = label;
          if (numericSuitable(property)) {
            const yOption = numericList.createEl("option", { value: property.key });
            yOption.label = label;
          }
          const row = propertyTableBody.createEl("tr");
          row.createEl("th", { text: property.label, attr: { scope: "row" } });
          row.createEl("td").createEl("code", { text: property.key });
          row.createEl("td", { text: property.types.join(" / ") || "no values" });
          row.createEl("td", { text: String(property.missing) });
          row.createEl("td", {
            text: `date-X ${dateSuitable(property) ? "yes" : "no"}; numeric Y ${numericSuitable(property) ? "yes" : "no"}`,
          });
          const diagnostics = row.createEl("td");
          const messages = [
            ...(property.types.length > 1 ? [`Mixed types: ${property.types.join(" / ")}.`] : []),
            ...(property.missing ? [`Missing from ${property.missing} note(s).`] : []),
            ...property.invalid,
          ];
          if (messages.length) {
            const list = diagnostics.createEl("ul");
            for (const diagnostic of messages)
              list.createEl("li", { text: diagnostic });
          } else diagnostics.setText("None");
        }
        showManualOptions(properties);
        const dateCount = properties.filter(dateSuitable).length;
        const numericCount = properties.filter(numericSuitable).length;
        const missingCount = properties.filter((item) => item.missing > 0).length;
        const incompatibleCount = properties.filter(
          (item) => item.types.length > 1 || item.invalid.length > 0,
        ).length;
        propertyDetails.querySelector("summary")!.textContent =
          `Property details (${properties.length})`;
        discoveryStatus.textContent = properties.length
          ? `${properties.length} properties found; ${dateCount} suitable for date X; ${numericCount} suitable for numeric Y; ${missingCount} with missing values; ${incompatibleCount} mixed or invalid.`
          : "No properties found in this dataset subtree.";
      } else {
        showManualOptions([]);
        propertyDetails.querySelector("summary")!.textContent = "Property details (unavailable)";
        discoveryStatus.textContent = state;
      }
      updateConfiguredStatus();
    };
    loadProperties = async (sourceValue: string) => {
      const request = ++this.discoveryGeneration;
      const folder = sourceValue.trim();
      discoveredProperties = undefined;
      if (!folder || !this.service.folders().includes(folder)) {
        const status = folder
          ? `Dataset folder “${folder}” is not available. Choose an existing folder to inspect properties.`
          : "Choose a dataset folder to inspect properties.";
        updatePropertyPanel(undefined, status);
        return;
      }
      lastAutoDiscoveryFolder = folder;
      updatePropertyPanel(undefined, `Loading properties from ${folder}…`);
      refreshPropertiesButton.disabled = true;
      try {
        const properties = await this.service.discover(folder);
        if (
          this.uiClosed ||
          this.editorKey !== key ||
          this.editorGeneration !== editorGeneration ||
          this.discoveryGeneration !== request ||
          source.value.trim() !== folder
        )
          return;
        discoveredProperties = properties;
        updatePropertyPanel(properties, "");
      } catch (error) {
        if (
          this.uiClosed ||
          this.editorKey !== key ||
          this.editorGeneration !== editorGeneration ||
          this.discoveryGeneration !== request ||
          source.value.trim() !== folder
        )
          return;
        updatePropertyPanel(undefined, `Property discovery failed: ${message(error)}`);
      } finally {
        if (
          !this.uiClosed &&
          this.editorKey === key &&
          this.editorGeneration === editorGeneration &&
          this.discoveryGeneration === request
        )
          refreshPropertiesButton.disabled = false;
      }
    };
    const schedulePropertyRefresh = () => {
      const folder = String(draft.values.source ?? "").trim();
      if (folder === lastAutoDiscoveryFolder) return;
      if (this.discoveryTimer !== undefined) clearTimeout(this.discoveryTimer);
      this.discoveryTimer = setTimeout(() => {
        this.discoveryTimer = undefined;
        void loadProperties(folder);
      }, 150);
    };
    source.addEventListener("input", () => {
      this.discoveryGeneration++;
      lastAutoDiscoveryFolder = undefined;
      if (this.discoveryTimer !== undefined) {
        clearTimeout(this.discoveryTimer);
        this.discoveryTimer = undefined;
      }
      discoveredProperties = undefined;
      updatePropertyPanel(
        undefined,
        "Dataset folder changed. Finish entering or select a valid folder to refresh properties.",
      );
      refreshPropertiesButton.disabled = false;
    });
    source.addEventListener("change", schedulePropertyRefresh);
    source.addEventListener("blur", schedulePropertyRefresh);
    updatePropertyPanel(undefined, "Choose a dataset folder to inspect properties.");
    void loadProperties(String(draft.values.source ?? ""));
    addButton = this.button(
      form,
      "Add " + (field === "series" ? "series" : "parameter"),
      () => {
        if (field === "series" && rows.length >= 4) {
          new Notice("Charts support one to four series.");
          return;
        }
        rows.push({ property: "", label: "" });
        renderRows();
      },
    );
    input(
      field === "series" ? "End date (optional)" : "Endpoint (optional)",
      String(draft.values.end ?? ""),
      (v) => (draft.values.end = v),
    );
    if (field === "series") {
      input(
        "Start date (optional)",
        String(draft.values.start ?? ""),
        (v) => (draft.values.start = v),
      );
      input(
        "Window (optional, e.g. 12 months)",
        String(draft.values.window ?? ""),
        (v) => (draft.values.window = v),
      );
      for (const [property, label] of [
        ["subtitle", "Subtitle"],
        ["x_axis_label", "X axis label"],
        ["y_axis_label", "Y axis label"],
        ["x_axis_unit", "X axis unit"],
        ["y_axis_unit", "Y axis unit"],
      ])
        input(
          label + " (optional)",
          String(draft.values[property] ?? ""),
          (v) => (draft.values[property] = v),
        );
    }
    if (field === "series") {
      const publication = this.select(
        form,
        "Chart presentation",
        [
          ["legacy", "Legacy (existing layout)"],
          ["publication", "Publication (print layout)"],
          ["publication-v2", "Publication v2 (independent axes)"],
          ...(draft.values.presentation !== undefined &&
          draft.values.presentation !== "legacy" &&
          draft.values.presentation !== "publication" &&
          draft.values.presentation !== "publication-v2"
            ? [["__preserve-opaque__", `Unrecognized saved value (preserved): ${JSON.stringify(draft.values.presentation)}`]]
            : []),
        ],
        draft.values.presentation === "publication" ||
        draft.values.presentation === "publication-v2" ||
        draft.values.presentation === "legacy"
          ? String(draft.values.presentation)
          : draft.values.presentation === undefined
            ? "legacy"
            : "__preserve-opaque__",
      );
      publication.addEventListener("change", () => {
        if (publication.value === "__preserve-opaque__") return;
        draft.values.presentation = publication.value;
        this.showEditor(key, draft, "Chart presentation");
      });
      form.createEl("p", {
        text:
          draft.values.presentation === "publication"
            ? "Publication: readable labels and dash/marker identities. Publish with installed DejaVu/Liberation fonts, at least 3.5 inches wide, and check final placement. Bounds apply to selected data; source validation remains whole-folder."
            : draft.values.presentation === "publication-v2"
              ? "Publication v2: independent Y endpoints, readable tick policies and reserved axis-title layout. Existing paired y_min/y_max remain active until y_axis is edited; explicit endpoints never clip data."
              : draft.values.presentation === undefined || draft.values.presentation === "legacy"
                ? "Legacy: an absent or explicit legacy mode keeps existing renderer behavior. Publication-only fields are not activated unless a publication mode is selected."
                : "This saved presentation value is not recognized by the editor. It is preserved unless you deliberately select a supported mode.",
      });
      if (draft.values.presentation === "publication-v2") {
        form.createEl("p", {
          text: "Publication v2 uses independent automatic/hard endpoints. Include zero preserves negative observations. Ticks never round observations.",
        });
        form.createEl("p", {
          text: "To remove an optional caption, description, unit or y_axis key entirely, edit that YAML key in the definition note. Clearing a text field stores an empty value; source comments and unknown fields are preserved.",
        });
        const policy = (
          draft.values.y_axis &&
          typeof draft.values.y_axis === "object" &&
          !Array.isArray(draft.values.y_axis)
            ? draft.values.y_axis
            : { minimum: "auto", maximum: "auto", ticks: "auto" }
        ) as Properties;
        const persistPolicy = () => {
          draft.values.y_axis = policy;
        };
        const pairedLegacyBounds =
          draft.values.y_min !== undefined &&
          draft.values.y_max !== undefined &&
          !draft.values.y_axis;
        if (pairedLegacyBounds)
          form.createEl("p", {
            text: "This definition still uses its compatible paired y_min/y_max bounds. To use independent endpoints or tick policies, remove both old fields deliberately in the definition note, then reload the editor. Comments and unknown fields are preserved; this editor will not remove those bounds automatically.",
          });
        const endpoint = (
          field: "minimum" | "maximum",
          title: string,
          allowZero: boolean,
        ) => {
          const modes: [[string, string], ...[string, string][]] = [
            ["auto", "Automatic"],
            ...(allowZero
              ? [
                  ["zero", "Include zero (preserve negative data)"] as [
                    string,
                    string,
                  ],
                ]
              : []),
            ["value", "Explicit value"],
          ];
          const current = policy[field],
            mode =
              typeof current === "number" ? "value" : String(current ?? "auto");
          const control = this.select(form, title + " policy", modes, mode);
          input(
            title + " explicit value",
            typeof current === "number" ? String(current) : "",
            (v) => {
              if (control.value !== "value") control.value = "value";
              policy[field] = v.trim() ? Number(v) : Number.NaN;
              persistPolicy();
            },
          );
          control.addEventListener("change", () => {
            if (control.value === "auto" || control.value === "zero")
              policy[field] = control.value;
            else if (typeof policy[field] !== "number")
              policy[field] = Number.NaN;
            persistPolicy();
          });
        };
        if (!pairedLegacyBounds) {
          endpoint("minimum", "Minimum", true);
          endpoint("maximum", "Maximum", false);
          const tickMode = this.select(
            form,
            "Y tick policy",
            [
              ["auto", "Automatic readable intervals"],
              ["integer", "Integer-only tick values"],
              ["step", "Explicit positive step"],
            ],
            typeof policy.ticks === "object"
              ? "step"
              : String(policy.ticks ?? "auto"),
          );
          input(
            "Y tick step",
            typeof policy.ticks === "object"
              ? String((policy.ticks as Properties).step ?? "")
              : "",
            (v) => {
              tickMode.value = "step";
              policy.ticks = { step: v.trim() ? Number(v) : Number.NaN };
              persistPolicy();
            },
          );
          tickMode.addEventListener("change", () => {
            policy.ticks =
              tickMode.value === "step"
                ? {
                    step:
                      typeof policy.ticks === "object"
                        ? Number((policy.ticks as Properties).step)
                        : Number.NaN,
                  }
                : tickMode.value;
            persistPolicy();
          });
        }
        input(
          "Caption (plain text, up to 240 characters)",
          String(draft.values.caption ?? ""),
          (value) => (draft.values.caption = value),
        );
        input(
          "Description (plain text, up to 240 characters)",
          String(draft.values.description ?? ""),
          (value) => (draft.values.description = value),
        );
      }
      if (draft.values.presentation === "publication") {
        for (const [property, label] of [
          ["y_min", "Fixed Y minimum"],
          ["y_max", "Fixed Y maximum"],
        ]) {
          input(
            label + " (both or neither)",
            String(draft.values[property] ?? ""),
            (value) => {
              // Empty new fields are omitted; removing an existing option needs a
              // source-note edit rather than destroying comments/opaque fields.
              if (
                !value.trim() &&
                readEditableSafeOriginal(draft)[property] === undefined
              )
                delete draft.values[property];
              else draft.values[property] = value.trim() ? Number(value) : null;
            },
          );
        }
        input(
          "Caption (plain text, up to 240 characters)",
          String(draft.values.caption ?? ""),
          (value) => (draft.values.caption = value),
        );
        form.createEl("p", {
          text: "Automatic Y range when both limits are absent. To remove existing limits, edit the definition note; blanking a supplied limit is invalid. Long or unsupported text blocks generation with a diagnostic.",
        });
      }
    } else {
      const hasComparison = draft.values.comparison !== undefined;
      const pair = this.select(
        form,
        "Comparison selection",
        [
          ["canonical", "Canonical predecessor (legacy)"],
          ["explicit-pair", "Two explicit observations"],
        ],
        hasComparison ? "explicit-pair" : "canonical",
      );
      pair.addEventListener("change", () => {
        if (pair.value === "canonical" && hasComparison) {
          new Notice(
            "Remove the comparison mapping in the definition note to return to canonical selection; unknown fields/comments are preserved.",
          );
          pair.value = "explicit-pair";
          return;
        }
        if (pair.value === "explicit-pair" && !hasComparison) {
          draft.values.comparison = {
            mode: "explicit-pair",
            current: "",
            previous: "",
          };
          this.showEditor(key, draft, "Comparison selection");
        }
      });
      if (hasComparison) {
        const comparison = draft.values.comparison;
        if (
          !comparison ||
          typeof comparison !== "object" ||
          Array.isArray(comparison) ||
          (comparison as Properties).mode !== "explicit-pair"
        ) {
          form.createEl("p", {
            text: "Repair comparison in the definition note: it must be a mapping with mode explicit-pair.",
          });
        } else {
          for (const [property, label] of [
            ["current", "Current observation path"],
            ["previous", "Previous observation path"],
          ])
            input(
              label,
              String((comparison as Properties)[property] ?? ""),
              (value) => ((comparison as Properties)[property] = value),
            );
          form.createEl("p", {
            text: "Both exact .md paths must be inside the dataset. Previous date must be earlier; optional endpoint must equal current date. Missing/renamed paths block and never select a predecessor. Remove the mapping in the definition note to return to legacy comparison.",
          });
        }
      }
    }
    const output = input(
      "Output destination",
      String(draft.values.output ?? ""),
      (v) => {
        touched.output = true;
        draft.values.output = v;
      },
    );
    // Group the existing labeled controls without rebuilding them. Their
    // listeners, draft references and focus targets remain intact.
    for (const element of Array.from(form.children)) {
      if (Object.values(groups).includes(element as HTMLFieldSetElement))
        continue;
      if (element === titleGroup) continue;
      const label = element.textContent ?? "";
      const destination = /^(Output destination|Definition destination)/u.test(
        label,
      )
        ? groups.output
        : /Caption|Description|Chart presentation/u.test(label)
          ? groups.publication
          : /axis|Minimum|Maximum|tick/u.test(label)
            ? groups.axes
            : /Name \/ title|Subtitle|Series label|Parameter label|Chart title/u.test(
                  label,
                )
              ? groups.appearance
              : groups.data;
      destination.append(element);
    }
    const diagnostics = this.details.createDiv({
      cls: "mr-diagnostics",
      attr: { "aria-live": "polite" },
    });
    const feedback = this.details.createDiv({
      cls: "mr-save-feedback",
      attr: { "aria-live": "polite", role: "alert" },
    });
    const exposeInvalidField = (error: unknown) => {
      const text = message(error).toLowerCase();
      const fieldName = text.includes("minimum")
        ? "Minimum"
        : text.includes("maximum")
          ? "Maximum"
          : text.includes("ticks") || text.includes("tick")
            ? "Y tick"
            : text.includes("caption")
              ? "Caption"
              : text.includes("description")
                ? "Description"
                : text.includes("source")
                  ? "Dataset folder"
                  : text.includes("series[")
                    ? "Series label"
                    : text.includes("output")
                      ? "Output destination"
                      : text.includes("x_axis_label")
                        ? "X axis label"
                        : text.includes("y_axis_label")
                          ? "Y axis label"
                          : text.includes(" x ") ||
                              text.includes("date property")
                            ? "X property"
                            : undefined;
      if (!fieldName) return;
      const labels = Array.from(form.querySelectorAll("label.mr-field"));
      const candidates = labels.filter((label) =>
        (label.querySelector("span")?.textContent ?? "")
          .toLowerCase()
          .includes(fieldName.toLowerCase()),
      );
      const preferred =
        fieldName === "Y tick"
          ? (candidates.find((label) =>
              (label.querySelector("span")?.textContent ?? "").includes("step"),
            ) ?? candidates[0])
          : fieldName === "Minimum" || fieldName === "Maximum"
            ? (candidates.find((label) =>
                (label.querySelector("span")?.textContent ?? "").includes(
                  "explicit value",
                ),
              ) ?? candidates[0])
            : candidates[0];
      const control = preferred?.querySelector("input,select") as
        | HTMLElement
        | undefined;
      control?.setAttribute("aria-invalid", "true");
      control?.focus();
    };
    const actions = this.details.createDiv({ cls: "mr-actions" });
    const save = async (generate: boolean) => {
      if (this.busy || this.uiClosed) return;
      this.setBusy(true);
      feedback.textContent = "Saving definition…";
      try {
        const path = await this.service.save(draft);
        if (this.uiClosed) return;
        // A successful save turns generated spellings into durable labels.
        // Keep this editor's map marked until it is rebuilt, and do not persist
        // label provenance into the author's YAML.
        for (const generated of generatedLabels.values())
          generated.overridden = true;
        draft.generatedLabels = undefined;
        destination.disabled = true;
        type.disabled = true;
        this.selected = path;
        this.drafts.set(path, draft);
        if (key === ":new:") {
          this.drafts.delete(key);
          this.editorKey = path;
        }
        feedback.textContent =
          "Definition saved. " +
          (generate
            ? "Generation explicitly requested."
            : "No output was generated.");
        if (generate) {
          const results = await this.service.generate(path);
          if (!this.uiClosed)
            feedback.textContent = results
              .map((r) => r.status + ": " + r.message)
              .join("\n");
        }
        this.refreshDiagnostics();
      } catch (error) {
        if (!this.uiClosed) {
          feedback.textContent = message(error);
          exposeInvalidField(error);
        }
      } finally {
        this.setBusy(false);
      }
    };
    this.button(actions, "Save definition", () => save(false));
    this.button(actions, "Save and generate", () => save(true));
    this.button(actions, "Back to saved output", () => this.showSelected());
    if (draft.original !== null) {
      this.button(actions, "Open definition", () =>
        this.openFile(this.selected ?? draft.path),
      );
      this.button(actions, "Reload latest (replace draft)", async () => {
        try {
          const latest = await this.service.draft(this.selected ?? draft.path);
          if (this.uiClosed) return;
          this.drafts.set(key, latest);
          this.showEditor(key, latest);
        } catch (e) {
          feedback.textContent = message(e);
        }
      });
      this.button(actions, "Reconcile with latest", async () => {
        try {
          const latest = await this.service.draft(this.selected ?? draft.path);
          const original = readEditable(draft.original!).data;
          latest.values = reconcile(original, draft.values, latest.values);
          if (this.uiClosed) return;
          this.drafts.set(key, latest);
          this.showEditor(key, latest);
        } catch (e) {
          feedback.textContent = message(e);
        }
      });
    }
    this.refreshDiagnostics();
    const focusTarget = focusField
      ? Array.from(form.querySelectorAll("label.mr-field")).find(
          (label) =>
            label.querySelector("span")?.textContent === focusField,
        )?.querySelector("input,select")
      : name;
    (focusTarget as HTMLElement | null)?.focus();
  }
  async onClose() {
    this.uiClosed = true;
    this.editorGeneration++;
    this.discoveryGeneration++;
    if (this.previewTimer !== undefined) {
      clearTimeout(this.previewTimer);
      this.previewTimer = undefined;
    }
    if (this.discoveryTimer !== undefined) {
      clearTimeout(this.discoveryTimer);
      this.discoveryTimer = undefined;
    }
    this.clearPreview();
    this.unsubscribe?.();
    this.unfiles?.();
    for (const modal of this.dialogs) modal.close();
    this.dialogs.clear();
    this.contentEl.empty();
  }
}
/** Explicit three-way reconciliation; overlapping edits never silently choose a side. */
export function reconcile(
  original: Properties,
  draft: Properties,
  latest: Properties,
): Properties {
  const result = { ...latest };
  for (const [key, value] of Object.entries(draft)) {
    if (JSON.stringify(value) === JSON.stringify(original[key])) continue;
    if (JSON.stringify(latest[key]) !== JSON.stringify(original[key]))
      throw Error(
        "Both versions changed “" +
          key +
          "”. Open the definition and reconcile this field; your draft is retained.",
      );
    result[key] = value;
  }
  return result;
}

/** Static table-only preview: no Markdown processors, embeds, HTML or code execution. */
export function renderSavedTable(content: string, parent: HTMLElement) {
  const lines = content.split(/\r?\n/).filter((l) => l.startsWith("|"));
  if (lines.length < 2 || !/^\|(?:[-:]+\|)+$/.test(lines[1]))
    throw Error(
      "The saved file does not contain a supported state table. Open output to inspect it.",
    );
  const comparison = content
    .split(/\r?\n/u)
    .find((line) => line.startsWith("Explicit-pair comparison: "));
  if (comparison)
    parent.createEl("p", {
      text: comparison.replace(/\\([\\`*_{}\[\]()<>#!|])/gu, "$1"),
    });
  const table = parent.createEl("table");
  const header = table.createEl("thead").createEl("tr"),
    body = table.createEl("tbody");
  const cells = (line: string) => {
    const result: string[] = [];
    let cell = "";
    for (let i = 1; i < line.length; i++) {
      if (line[i] === "\\" && i + 1 < line.length) cell += line[++i];
      else if (line[i] === "|") {
        result.push(cell);
        cell = "";
      } else cell += line[i];
    }
    return result;
  };
  for (const text of cells(lines[0])) header.createEl("th", { text });
  for (const line of lines.slice(2)) {
    const row = body.createEl("tr");
    for (const text of cells(line)) row.createEl("td", { text });
  }
}
