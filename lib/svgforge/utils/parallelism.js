import {availableParallelism} from 'node:os';

/**
 Number of CPU cores available to this process

 Unlike `os.cpus().length`, `availableParallelism()` respects cgroup limits and
 CPU affinity, so containers and CI runners report the cores they actually get
 instead of the host's core count.

 @param {number} [cores] Core count override, mainly for tests
 @returns {number} Number of cores, never less than 1
 */
export function coreCount(cores = availableParallelism()) {
  return Math.max(1, cores);
}

/**
 Number of worker threads for the SVGO pool

 One core is deliberately left to the main thread, which keeps parsing and
 serializing shapes while the workers optimize.

 @param {number} [cores] Core count override, mainly for tests
 @returns {number} Number of workers, never less than 1
 */
export function svgoWorkerCount(cores) {
  return Math.max(1, coreCount(cores) - 1);
}

/**
 Number of shapes processed concurrently

 More shapes at once add no CPU throughput — the main thread is single
 threaded — they only overlap file reads and worker waits, so this is pinned to
 the available cores with the historical four as a floor for small machines.

 @param {number} [cores] Core count override, mainly for tests
 @returns {number} Concurrency, never less than 4
 */
export function shapeConcurrency(cores) {
  return Math.max(4, coreCount(cores));
}
