export interface MutationQueue {
  tail: Promise<unknown>;
}
export interface MutationQueueHost {
  murmurationReportsMutationQueue?: { version: 1; tail: Promise<unknown> };
}
/** Retain the in-flight barrier on the App across plugin module reloads. No vault storage. */
export function mutationQueueFor(host: MutationQueueHost): MutationQueue {
  if (!host.murmurationReportsMutationQueue)
    host.murmurationReportsMutationQueue = {
      version: 1,
      tail: Promise.resolve(),
    };
  const queue = host.murmurationReportsMutationQueue;
  if (queue.version !== 1 || typeof queue.tail?.then !== "function")
    throw new Error("Incompatible Reports mutation queue.");
  return queue;
}
