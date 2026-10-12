import { ReportResult } from "../reports/GenerationCoordinator";
export const CAPABILITY_KEY = "murmurationReports";
export interface ReportsCapability {
  readonly version: 1;
  generateDefinition(path: string): Promise<ReportResult>;
  generateAll(): Promise<readonly ReportResult[]>;
  showResults(results: readonly ReportResult[]): void;
}
export interface CapabilityHost {
  murmurationReports?: ReportsCapability;
}
export function registerCapability(
  host: CapabilityHost,
  capability: ReportsCapability,
): () => void {
  if (host.murmurationReports)
    throw new Error("A Reports capability is already registered.");
  host.murmurationReports = capability;
  return () => {
    if (host.murmurationReports === capability) delete host.murmurationReports;
  };
}
