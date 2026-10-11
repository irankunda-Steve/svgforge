import {optimize as realOptimize} from 'svgo';
import svgoTransform from '../../../lib/svgforge/transform/svgo.js';
import {isSerializable, optimizeInWorker, terminateWorkers} from '../../../lib/svgforge/transform/svgo-pool.js';
import {setDependency, resetDependencies} from '../../../lib/deps.js';
import {
  afterEach,
  createMock,
  describe,
  expect,
  it,
} from '../../helpers/harness.js';

const TEST_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';

// The exact config svgoTransform assembles for default settings with
// xmlDeclaration/doctypeDeclaration disabled.
const DEFAULT_CONFIG = {
  plugins: [{
    name: 'preset-default',
    params: {
      overrides: {
        removeUnknownsAndDefaults: {
          keepRoleAttr: true,
        },
      },
    },
  }, {
    name: 'removeViewBox',
  }, {
    name: 'removeTitle',
  }, {
    name: 'removeXMLProcInst',
  }, {
    name: 'removeDoctype',
  }],
};

const createSpriter = () => ({
  config: {
    svg: {
      xmlDeclaration: false,
      doctypeDeclaration: false,
    },
    log: {
      transports: [],
    },
  },
  error: createMock(),
  debug: createMock(),
});

const createShape = () => ({
  name: 'shape',
  setSVG: createMock(),
  getSVG: createMock().mockReturnValue(TEST_SVG),
});

const runTransform = (shape, config, spriter) => new Promise(resolve => {
  svgoTransform(shape, config, spriter, resolve);
});

afterEach(async () => {
  resetDependencies();
  await terminateWorkers();
});

describe('testing isSerializable', () => {
  it('should accept plain objects, arrays and primitives', () => {
    expect(isSerializable({plugins: [{name: 'preset-default', params: {overrides: {a: false}}}]})).toBe(true);
    expect(isSerializable(['a', 1, null])).toBe(true);
    expect(isSerializable('string')).toBe(true);
    expect(isSerializable(42)).toBe(true);
    expect(isSerializable(undefined)).toBe(true);
  });

  it('should reject functions, symbols and class instances', () => {
    const customPlugin = () => {};
    expect(isSerializable(customPlugin)).toBe(false);
    expect(isSerializable({fn: customPlugin})).toBe(false);
    expect(isSerializable(Symbol('x'))).toBe(false);
    expect(isSerializable(new Date())).toBe(false);
    expect(isSerializable(/regex/u)).toBe(false);
  });

  it('should accept cyclic plain objects', () => {
    const cyclic = {nested: {}};
    cyclic.nested.self = cyclic;
    expect(isSerializable(cyclic)).toBe(true);
  });
});

describe('testing svgoTransform with the worker pool', () => {
  it('should dispatch optimization to a worker and apply the result', async () => {
    const workerOptimize = createMock(optimizeInWorker);
    setDependency('svgo:pool:optimize', workerOptimize);
    const shape = createShape();
    const spriter = createSpriter();

    const error = await runTransform(shape, {}, spriter);

    expect(error).toBeNull();
    expect(workerOptimize).toHaveBeenCalledTimes(1);
    expect(workerOptimize).toHaveBeenCalledWith(TEST_SVG, DEFAULT_CONFIG);
    expect(shape.setSVG).toHaveBeenCalledWith(realOptimize(TEST_SVG, DEFAULT_CONFIG).data);
  });

  it('should fall back to the main thread when the optimizer is replaced', () => {
    const mockOptimize = createMock().mockReturnValue({data: 'optimized'});
    setDependency('svgo:optimize', mockOptimize);
    const workerOptimize = createMock();
    setDependency('svgo:pool:optimize', workerOptimize);
    const shape = createShape();
    const spriter = createSpriter();
    const callback = createMock();

    svgoTransform(shape, {}, spriter, callback);

    expect(mockOptimize).toHaveBeenCalledWith(TEST_SVG, DEFAULT_CONFIG);
    expect(workerOptimize).not.toHaveBeenCalled();
    expect(shape.setSVG).toHaveBeenCalledWith('optimized');
    expect(callback).toHaveBeenCalledWith(null);
  });

  it('should fall back to the main thread for non-serializable configs', async () => {
    const workerOptimize = createMock();
    setDependency('svgo:pool:optimize', workerOptimize);
    const shape = createShape();
    const spriter = createSpriter();

    const error = await runTransform(shape, {extra: () => 'ignored'}, spriter);

    // SVGO ignores unknown config keys, so the in-process optimization runs
    // fine — it just must not be handed to a worker.
    expect(error).toBeNull();
    expect(workerOptimize).not.toHaveBeenCalled();
    expect(shape.setSVG).toHaveBeenCalledWith(realOptimize(TEST_SVG, DEFAULT_CONFIG).data);
  });

  it('should report worker failures through the callback', async () => {
    const TEST_ERROR = new Error('worker boom');
    const workerOptimize = createMock().mockReturnValue(Promise.reject(TEST_ERROR));
    setDependency('svgo:pool:optimize', workerOptimize);
    const shape = createShape();
    const spriter = createSpriter();

    const error = await runTransform(shape, {}, spriter);

    expect(error).toBe(TEST_ERROR);
    expect(spriter.error).toHaveBeenCalledWith('Optimizing "%s" with SVGO failed with error "%s"', 'shape', TEST_ERROR);
  });
});

describe('testing the real SVGO worker', () => {
  it('should optimize an SVG on a worker identically to the main thread', async () => {
    const workerResult = await optimizeInWorker(TEST_SVG, DEFAULT_CONFIG);
    expect(workerResult.data).toBe(realOptimize(TEST_SVG, DEFAULT_CONFIG).data);
  });
});
