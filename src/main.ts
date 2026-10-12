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
    const dialogs = new Set<Modal>();
    const showResults = (results: readonly ReportResult[]) => {
      if (!loaded) return;
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
