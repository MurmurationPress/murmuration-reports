import { Notice, Plugin } from "obsidian";
import { GenerationCoordinator } from "./reports/GenerationCoordinator";
import { reportVault } from "./obsidian/VaultAdapter";
import {
  CapabilityHost,
  registerCapability,
} from "./obsidian/ReportsCapability";
import { installReportCommands } from "./commands/ReportCommands";
import { AdoptionModal, ResultsModal } from "./ui/ReportInteractions";
export default class MurmurationReports extends Plugin {
  private coordinator!: GenerationCoordinator;
  async onload(): Promise<void> {
    this.coordinator = new GenerationCoordinator(reportVault(this.app));
    this.register(() => this.coordinator.dispose());
    const host = this.app as typeof this.app & CapabilityHost;
    this.register(
      registerCapability(host, {
        version: 1,
        generateDefinition: (path) => this.coordinator.generate(path),
        generateAll: () => this.coordinator.generateAll(),
        showResults: (results) => new ResultsModal(this.app, results).open(),
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
      showResults: (results) => new ResultsModal(this.app, results).open(),
      adopt: async (path) => {
        const inspection = await this.coordinator.inspectAdoption(path);
        const accepted = await new Promise<boolean>((resolve) =>
          new AdoptionModal(this.app, inspection, resolve).open(),
        );
        if (accepted)
          new ResultsModal(this.app, [
            await this.coordinator.adoptAndGenerate(inspection),
          ]).open();
      },
    });
  }
}
