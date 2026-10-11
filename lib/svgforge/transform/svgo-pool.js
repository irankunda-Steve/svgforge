import process from 'node:process';
import {Worker} from 'node:worker_threads';
import {svgoWorkerCount} from '../utils/parallelism.js';

const WORKER_PATH = new URL('svgo-worker.js', import.meta.url);

/**
 Number of concurrent SVGO workers. Defaults to the CPU cores available to the
 process (cgroup-aware on Linux) minus one, so the main thread keeps a core for
 parsing and serializing shapes; `SVGFORGE_SVGO_WORKERS` overrides it, e.g. in
 containers that report the host's core count.
 */
const DEFAULT_POOL_SIZE = svgoWorkerCount();
const configuredPoolSize = Number(process.env.SVGFORGE_SVGO_WORKERS ?? '');
const POOL_SIZE = Number.isSafeInteger(configuredPoolSize) && configuredPoolSize > 0 ? configuredPoolSize : DEFAULT_POOL_SIZE;

// Module-level pool state, shared by all spriter instances: workers are only
// spawned lazily (on first use), kept alive across compiles and unreferenced
// while idle, so they never keep the process from exiting.
const workers = [];
const idle = [];
const queue = [];
const tasks = new Map();
let nextTaskId = 0;

/**
 Test whether a value can be transferred to a worker thread via structured
 clone, so user-supplied SVGO configurations can be handed to a worker safely.
 Conservative on purpose: anything exotic (functions, class instances,
 regular expressions, …) falls back to main-thread optimization — correctness
 is preferred over parallelism.

 @param {unknown} value Value to check
 @param {Set} [seen] Already visited objects, for cycle detection
 @returns {boolean} Whether the value is structured-clone safe
 */
export function isSerializable(value, seen = new Set()) {
  if (value === null || typeof value !== 'object') {
    return typeof value !== 'function' && typeof value !== 'symbol';
  }

  if (seen.has(value)) {
    return true;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.every(item => isSerializable(item, seen));
  }

  const prototype = Object.getPrototypeOf(value);

  return (prototype === Object.prototype || prototype === null) && Object.values(value).every(item => isSerializable(item, seen));
}

/**
 Spawn a worker, register its lifecycle handlers and add it to the pool.
 */
const spawnWorker = () => {
  const worker = new Worker(WORKER_PATH);
  worker.unref();
  worker.on('message', onWorkerMessage(worker));
  worker.on('error', onWorkerError(worker));
  worker.on('exit', onWorkerExit(worker));
  workers.push(worker);
  idle.push(worker);
};

/**
 Reject the task a worker was processing, if any.

 @param {Worker} worker Worker whose task should be rejected
 @param {Error} error Reason for the rejection
 */
const rejectWorkerTask = (worker, error) => {
  for (const [id, task] of tasks) {
    if (task.worker === worker) {
      tasks.delete(id);
      task.reject(error);
      return;
    }
  }
};

/**
 Handle a completed optimization result posted back by a worker.

 @param {Worker} worker The worker that finished its task
 @returns {(result: object) => void} Message handler
 */
const onWorkerMessage = worker => result => {
  const task = tasks.get(result.id);

  if (!task) {
    return;
  }

  tasks.delete(result.id);
  idle.push(worker);

  if (result.error) {
    // Error objects do not survive structured clone — rebuild them from parts.
    const error = new Error(result.error.message);
    Object.defineProperty(error, 'stack', {
      value: result.error.stack,
      configurable: true,
      writable: true,
    });
    task.reject(error);
  } else {
    task.resolve({data: result.data});
  }

  dispatch();
};

/**
 Handle a worker failure: reject the affected task. The worker is removed by
 its subsequent 'exit' event.

 @param {Worker} worker The worker that failed
 @returns {(error: Error) => void} Error handler
 */
const onWorkerError = worker => error => {
  rejectWorkerTask(worker, error);
};

/**
 Handle a worker exit: clean up the worker and reject dangling tasks (e.g. a
 worker that was terminated externally without an 'error' event).

 @param {Worker} worker The worker that exited
 @returns {() => void} Exit handler
 */
const onWorkerExit = worker => () => {
  rejectWorkerTask(worker, new Error('SVGO worker exited unexpectedly'));
  workers.splice(workers.indexOf(worker), 1);
  const idleIndex = idle.indexOf(worker);

  if (idleIndex !== -1) {
    idle.splice(idleIndex, 1);
  }

  dispatch();
};

/**
 Keep the pool referenced while tasks are in flight, so it holds the event
 loop open during a compile, and unreferenced when idle, so the process can
 exit once all compiles finished.
 */
const updateWorkerRefState = () => {
  const hasActiveTasks = tasks.size > 0;

  for (const worker of workers) {
    if (hasActiveTasks) {
      worker.ref();
    } else {
      worker.unref();
    }
  }
};

/**
 Feed queued tasks to idle workers, spawning new workers on demand up to the
 pool size.
 */
const dispatch = () => {
  while (queue.length > 0) {
    if (idle.length === 0) {
      if (workers.length < POOL_SIZE) {
        spawnWorker();
        continue;
      }

      break;
    }

    const task = queue.shift();
    const worker = idle.shift();
    task.worker = worker;
    tasks.set(task.id, task);

    try {
      worker.postMessage({
        id: task.id,
        svg: task.svg,
        config: task.config,
      });
    } catch (error) {
      idle.push(worker);
      tasks.delete(task.id);
      task.reject(error);
    }
  }

  updateWorkerRefState();
};

/**
 Optimize an SVG string on a worker thread.

 @param {string} svg SVG source
 @param {object} config SVGO configuration
 @returns {Promise<{data: string}>} Optimized SVG
 */
export const optimizeInWorker = (svg, config) => new Promise((resolve, reject) => {
  queue.push({
    id: nextTaskId++,
    svg,
    config,
    resolve,
    reject,
  });
  dispatch();
});

/**
 Shut down all workers and reject pending tasks. Mainly used by tests.

 @returns {Promise<void>} Resolves once all workers terminated
 */
export const terminateWorkers = async () => {
  for (const task of queue) {
    task.reject(new Error('SVGO worker pool terminated'));
  }

  queue.length = 0;

  for (const [, task] of tasks) {
    task.reject(new Error('SVGO worker pool terminated'));
  }

  tasks.clear();
  await Promise.allSettled(workers.map(worker => worker.terminate()));
  workers.length = 0;
  idle.length = 0;
};
