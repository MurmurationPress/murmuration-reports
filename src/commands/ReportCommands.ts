import { ReportResult } from "../reports/GenerationCoordinator";
import { CapabilityHost } from "../obsidian/ReportsCapability";
export interface CommandHost {
  addCommand(command: {
    id: string;
    name: string;
    callback: () => void;
  }): unknown;
  activePath(): string | null;
  capabilityHost: CapabilityHost;
  showResults(results: readonly ReportResult[]): void;
  notice(message: string): void;
  adopt(path: string): Promise<void>;
}
export function installReportCommands(host: CommandHost): void {
  const run = async (all: boolean) => {
    const path = host.activePath(); // Capture before any await.
    const capability = host.capabilityHost.murmurationReports;
    if (!capability || capability.version !== 1) {
      host.notice(
        "Murmuration Reports is unavailable. Enable it to generate reports.",
      );
      return;
    }
    if (!all && !path) {
      host.notice("Open a report definition note first.");
      return;
    }
    try {
      host.showResults(
        all
          ? await capability.generateAll()
          : [await capability.generateDefinition(path!)],
      );
    } catch (error) {
      host.notice(error instanceof Error ? error.message : String(error));
    }
  };
  host.addCommand({
    id: "generate-derived-artefact",
    name: "Generate active report definition",
    callback: () => {
      void run(false);
    },
  });
  host.addCommand({
    id: "generate-all-derived-artefacts",
    name: "Generate all report definitions",
    callback: () => {
      void run(true);
    },
  });
  host.addCommand({
    id: "adopt-report-output",
    name: "Adopt active report output and generate",
    callback: () => {
      const path = host.activePath();
      if (!path) {
        host.notice("Open a report definition note first.");
        return;
      }
      void host
        .adopt(path)
        .catch((error) =>
          host.notice(error instanceof Error ? error.message : String(error)),
        );
    },
  });
}
