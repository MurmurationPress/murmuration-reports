import { ManagerService } from "./manager/ManagerService";
import { ReportsView, REPORTS_VIEW } from "./manager/ReportsView";
import { Notice, Plugin, Modal } from "obsidian";
import { GenerationCoordinator } from "./reports/GenerationCoordinator";
import { reportVault } from "./obsidian/VaultAdapter";
import {
  CapabilityHost,
  registerCapability,
} from "./obsidian/ReportsCapability";
import { installReportCommands } from "./commands/ReportCommands";
import { AdoptionModal, ResultsModal } from "./ui/ReportInteractions";
import { mutationQueueFor, MutationQueueHost } from "./obsidian/MutationQueue";
import type { ReportResult } from "./reports/GenerationCoordinator";
export default class MurmurationReports extends Plugin {
  private coordinator!: GenerationCoordinator;
  async onload(): Promise<void> {
    const coordinator = (this.coordinator = new GenerationCoordinator(
      reportVault(this.app, (ref) => this.registerEvent(ref)),
      mutationQueueFor(this.app as typeof this.app & MutationQueueHost),
    ));
    let loaded = true;
    const manager = new ManagerService(
      this.app,
      coordinator,
      mutationQueueFor(this.app as typeof this.app & MutationQueueHost),
    );
    this.registerView(REPORTS_VIEW, (leaf) => new ReportsView(leaf, manager));
    let opening: Promise<void> | undefined;
    const openReports = (): Promise<void> => {
      if (opening) return opening;
      const task = (async () => {
        if (!loaded) return;
        let leaf = this.app.workspace.getLeavesOfType(REPORTS_VIEW)[0];
        if (!leaf) {
          leaf = this.app.workspace.getLeaf("tab");
          await leaf.setViewState({ type: REPORTS_VIEW, active: true });
        }
        await leaf.loadIfDeferred();
        if (!loaded) {
          leaf.detach();
          return;
        }
        await this.app.workspace.revealLeaf(leaf);
      })();
      opening = task;
      void task
        .finally(() => {
          if (opening === task) opening = undefined;
        })
        .catch((error) => {
          if (loaded) new Notice(String(error));
        });
      return task;
    };
    this.addCommand({
      id: "open-reports",
      name: "Open Reports",
      callback: () => {
        void openReports().catch(() => {});
      },
    });
    this.addRibbonIcon("bar-chart-3", "Open Reports", () => {
      void openReports().catch(() => {});
    });
    this.register(() => {
      manager.dispose();
      this.app.workspace.detachLeavesOfType(REPORTS_VIEW);
    });
    const dialogs = new Set<Modal>();
    const showResults = (results: readonly ReportResult[]) => {
      if (!loaded) return;
      manager.recordMany(results);
      const modal = new ResultsModal(this.app, results, () =>
        dialogs.delete(modal),
      );
      dialogs.add(modal);
      modal.open();
    };
    this.register(() => {
      loaded = false;
      coordinator.dispose();
      for (const dialog of dialogs) dialog.close();
      dialogs.clear();
    });
    const host = this.app as typeof this.app & CapabilityHost;
    this.register(
      registerCapability(host, {
        version: 1,
        generateDefinition: (path) => coordinator.generate(path),
        generateAll: () => coordinator.generateAll(),
        showResults,
      }),
    );
    installReportCommands({
      addCommand: (command) => this.addCommand(command),
      capabilityHost: host,
      activePath: () => {
        const file = this.app.workspace.getActiveFile();
        return file?.extension === "md" ? file.path : null;
      },
      notice: (message) => {
        new Notice(message, 10000);
      },
      showResults,
      adopt: async (path) => {
        const inspection = await coordinator.inspectAdoption(path);
        if (!loaded) return;
        const accepted = await new Promise<boolean>((resolve) => {
          const modal = new AdoptionModal(this.app, inspection, (value) => {
            dialogs.delete(modal);
            resolve(value);
          });
          dialogs.add(modal);
          modal.open();
        });
        if (accepted && loaded)
          showResults([await coordinator.adoptAndGenerate(inspection)]);
      },
    });
  }
}
