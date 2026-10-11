/* eslint-disable node-test/no-export, node-test/prefer-context-mock, unicorn/no-top-level-side-effects -- Test harness helper: it exports the describe/it/expect API used across the suite and registers matchers/hooks at load time; the node:test mock is not exposed to a context here. */
import {inspect} from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {
  describe as _describe,
  it as _it,
  test as _test,
  before,
  after,

  mock,
} from 'node:test';
import {isObject} from '../../lib/svgforge/utils/index.js';
import compareSvg2Png from './compare-svg-2-png.js';
import compareHTML2Png from './compare-html-2-png.js';
import {closeBrowser} from './capture-browser.js';

const beforeAll = before;
const afterAll = after;

// ---------------------------------------------------------------------------
// Mocks (createMock / spyOn)
// ---------------------------------------------------------------------------
function makeMock(implementation) {
  const state = {
    defaultImpl: typeof implementation === 'function' ? implementation : undefined,
    once: [],
    instances: [],
  };

  const dispatch = function (...args) {
    if (state.once.length > 0) {
      const onceFn = state.once.shift();
      return onceFn.apply(this, args);
    }

    if (typeof state.defaultImpl === 'function') {
      return state.defaultImpl.apply(this, args);
    }

    return undefined;
  };

  const impl = mock.fn(dispatch);
  const callable = function (...args) {
    const result = impl.apply(this, args);
    state.instances.push(this);
    return result;
  };

  for (const key of Object.getOwnPropertyNames(impl)) {
    if (!Object.hasOwn(callable, key)) {
      callable[key] = impl[key];
    }
  }

  callable._isMockFunction = true;
  callable.getMockName = () => 'createMock()';
  callable.mockName = name => {
    callable._mockName = name;
    return callable;
  };

  callable.getMockImplementation = () => state.defaultImpl;
  callable.mock = {
    get calls() {
      return impl.mock.calls.map(c => [...c.arguments]);
    },
    get results() {
      return impl.mock.calls.map(c => ({
        type: c.error ? 'throw' : 'return',
        value: c.error ?? c.result,
      }));
    },
    get instances() {
      return state.instances;
    },
    get lastCall() {
      const all = impl.mock.calls;
      return all.length > 0 ? [...all.at(-1).arguments] : undefined;
    },
    get invocationCallOrder() {
      return impl.mock.calls.map((_, i) => i + 1);
    },
    callCount: () => impl.mock.callCount(),
  };
  callable.mockClear = () => {
    impl.mock.resetCalls();
    state.instances = [];
    return callable;
  };

  callable.mockReset = () => {
    state.defaultImpl = undefined;
    state.once = [];
    return callable.mockClear();
  };

  callable.mockImplementation = implFn => {
    state.defaultImpl = implFn;
    return callable;
  };

  callable.mockImplementationOnce = implFn => {
    state.once.push(implFn);
    return callable;
  };

  callable.mockReturnValue = value => {
    state.defaultImpl = () => value;
    return callable;
  };

  callable.mockReturnValueOnce = value => {
    state.once.push(() => value);
    return callable;
  };

  callable.mockResolvedValue = value => {
    state.defaultImpl = async () => value;
    return callable;
  };

  callable.mockResolvedValueOnce = value => {
    state.once.push(async () => value);
    return callable;
  };

  callable.mockRejectedValue = value => {
    state.defaultImpl = async () => {
      throw value;
    };

    return callable;
  };

  callable.mockRejectedValueOnce = value => {
    state.once.push(async () => {
      throw value;
    });
    return callable;
  };

  return callable;
}

const activeSpies = [];

function spyOn(object, methodName, accessType) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(object, methodName);
  const original = object[methodName];
  const spy = makeMock(typeof original === 'function' ? original : undefined);

  const cleanup = () => {
    if (originalDescriptor) {
      Object.defineProperty(object, methodName, originalDescriptor);
    } else {
      delete object[methodName];
    }
  };

  activeSpies.push(cleanup);

  if (accessType === 'get') {
    Object.defineProperty(object, methodName, {
      configurable: true,
      enumerable: true,
      get: () => spy,
      set: undefined,
    });
  } else {
    object[methodName] = spy;
  }

  spy.mockRestore = cleanup;
  return spy;
}

/**
 Restore every function replaced with spyOn() and every node:test mock created
 during the current test. Mocked functions created with createMock() carry no
 original implementation and therefore have nothing to restore.
 */
function restoreAllMocks() {
  while (activeSpies.length > 0) {
    activeSpies.pop()();
  }

  mock.restoreAll();
}

// ---------------------------------------------------------------------------
// Asymmetric matchers
// ---------------------------------------------------------------------------
function isAsymmetric(value) {
  return value !== null && value !== undefined && typeof value.asymmetricMatch === 'function';
}

class Any {
  constructor(expectedType) {
    this.expectedType = expectedType;
    this.asymmetricMatch = other => {
      if (expectedType === String) {
        return typeof other === 'string' || Object.prototype.toString.call(other) === '[object String]';
      }

      if (expectedType === Number) {
        return typeof other === 'number' || Object.prototype.toString.call(other) === '[object Number]';
      }

      if (expectedType === Boolean) {
        return typeof other === 'boolean' || Object.prototype.toString.call(other) === '[object Boolean]';
      }

      if (expectedType === Symbol) {
        return typeof other === 'symbol';
      }

      if (expectedType === BigInt) {
        return typeof other === 'bigint';
      }

      if (expectedType === Function) {
        return typeof other === 'function';
      }

      if (expectedType === Array) {
        return Array.isArray(other);
      }

      if (expectedType === Object) {
        return other !== null && typeof other === 'object';
      }

      return other instanceof expectedType;
    };

    this.toAsymmetricMatcher = () => `Any<${expectedType.name}>`;
  }
}

class Anything {
  asymmetricMatch = other => other !== null && other !== undefined;
  toAsymmetricMatcher = () => 'Anything';
}

class ObjectContaining {
  constructor(sample) {
    this.sample = sample;
    this.asymmetricMatch = other => {
      if (other === null || typeof other !== 'object') {
        return false;
      }

      return Object.keys(this.sample).every(k => matches(this.sample[k], other[k]));
    };

    this.toAsymmetricMatcher = () => 'ObjectContaining';
  }
}

class ArrayContaining {
  constructor(sample) {
    this.sample = sample;
    this.asymmetricMatch = other => {
      if (!Array.isArray(other)) {
        return false;
      }

      return this.sample.every(expected => other.some(actual => matches(expected, actual)));
    };

    this.toAsymmetricMatcher = () => 'ArrayContaining';
  }
}

class StringMatching {
  constructor(sample) {
    this.sample = sample instanceof RegExp ? sample : new RegExp(sample, 'u');
    this.asymmetricMatch = other => this.sample.test(String(other));
    this.toAsymmetricMatcher = () => 'StringMatching';
  }
}

class StringContaining {
  constructor(sample) {
    this.sample = sample;
    this.asymmetricMatch = other => typeof other === 'string' && other.includes(this.sample);
    this.toAsymmetricMatcher = () => 'StringContaining';
  }
}

function matches(expected, actual) {
  if (isAsymmetric(expected)) {
    return expected.asymmetricMatch(actual);
  }

  if (expected instanceof RegExp) {
    return typeof actual === 'string' && expected.test(actual);
  }

  if (typeof expected !== 'object' || expected === null) {
    return Object.is(expected, actual);
  }

  if (typeof actual !== 'object' || actual === null) {
    return false;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) {
      return false;
    }

    return expected.every((element, i) => matches(element, actual[i]));
  }

  if (expected instanceof Set) {
    if (!(actual instanceof Set) || expected.size !== actual.size) {
      return false;
    }

    return [...expected].every(v => [...actual].some(o => matches(v, o)));
  }

  const expectedKeys = Object.keys(expected);
  for (const key of expectedKeys) {
    if (!Object.hasOwn(actual, key) || !matches(expected[key], actual[key])) {
      return false;
    }
  }

  return true;
}

function isEqual(received, expected) {
  if (isAsymmetric(expected)) {
    return expected.asymmetricMatch(received);
  }

  if (isAsymmetric(received)) {
    return false;
  }

  if (Object.is(received, expected)) {
    return true;
  }

  if (expected instanceof RegExp && received instanceof RegExp) {
    return expected.source === received.source && expected.flags === received.flags;
  }

  if (typeof expected !== 'object' || expected === null || typeof received !== 'object' || received === null) {
    return false;
  }

  if (Array.isArray(expected) !== Array.isArray(received)) {
    return false;
  }

  if (Array.isArray(expected)) {
    if (expected.length !== received.length) {
      return false;
    }

    return expected.every((element, i) => isEqual(received[i], element));
  }

  if (expected instanceof Set) {
    return matches(expected, received);
  }

  const aKeys = Object.keys(expected).toSorted((a, b) => a.localeCompare(b));
  const bKeys = Object.keys(received).toSorted((a, b) => a.localeCompare(b));
  if (aKeys.join('\u{0}') !== bKeys.join('\u{0}')) {
    return false;
  }

  return aKeys.every(key => isEqual(received[key], expected[key]));
}

function format(value) {
  if (typeof value === 'string') {
    return value;
  }

  return inspect(value, {depth: null, compact: true});
}

function callCountOf(fn) {
  if (fn && fn.mock && Array.isArray(fn.mock.calls)) {
    return fn.mock.calls.length;
  }

  if (fn && fn.mock && typeof fn.mock.callCount === 'function') {
    return fn.mock.callCount();
  }

  throw new Error('Received value must be a mock or spy function');
}

function callsOf(fn) {
  if (fn && fn.mock && Array.isArray(fn.mock.calls)) {
    return fn.mock.calls;
  }

  if (fn && fn.mock && !Array.isArray(fn.mock.calls)) {
    const nodeCalls = fn.mock.calls;
    if (Array.isArray(nodeCalls)) {
      return nodeCalls.map(c => [...c.arguments]);
    }
  }

  throw new Error('Received value must be a mock or spy function');
}

function argsEqual(callArgs, expectedArgs) {
  if (!Array.isArray(callArgs) || callArgs.length !== expectedArgs.length) {
    return false;
  }

  return callArgs.every((a, i) => isEqual(a, expectedArgs[i]));
}

// ---------------------------------------------------------------------------
// Snapshot support
// ---------------------------------------------------------------------------
const describeStack = [];
let currentTestName = '';
let currentTestFile = '';
let currentSnapshotKey = '';

function snapshotKey() {
  return currentSnapshotKey || [...describeStack, currentTestName].filter(Boolean).join(' > ');
}

function snapshotFilePath() {
  const dir = path.dirname(currentTestFile);
  return path.join(dir, '__snapshots__', `${path.basename(currentTestFile)}.snap.json`);
}

function loadSnapshots() {
  const file = snapshotFilePath();
  if (!fs.existsSync(file)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function saveSnapshots(store) {
  const file = snapshotFilePath();
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(store, null, 2)}\n`);
}

function checkSnapshot(received) {
  const key = snapshotKey();
  const isUpdate = process.env.UPDATE_SNAPSHOTS === '1' || process.env.UPDATE_SNAPSHOTS === 'true';
  const store = loadSnapshots();

  if (isUpdate || !Object.hasOwn(store, key)) {
    store[key] = normalizeForSnapshot(received);
    saveSnapshots(store);
    return true;
  }

  return isEqual(received, store[key]);
}

function normalizeForSnapshot(value) {
  if (typeof value === 'string') {
    return value;
  }

  return inspect(value, {depth: null, compact: false});
}

// ---------------------------------------------------------------------------
// expect()
// ---------------------------------------------------------------------------
/**
 Check whether a thrown error matches a toThrow expectation

 @param {Error} error Thrown error
 @param {unknown} expected Expected error (constructor, Error instance, message string or regexp)
 @returns {boolean} Whether the error matches the expectation
 */
function errorMatches(error, expected) {
  if (expected === undefined) {
    return true;
  }

  if (expected instanceof Error) {
    return error instanceof expected.constructor && error.message === expected.message;
  }

  if (typeof expected === 'function') {
    return error instanceof expected;
  }

  if (typeof expected === 'string') {
    return error.message.includes(expected);
  }

  if (expected instanceof RegExp) {
    return expected.test(error.message);
  }

  return false;
}

function expect(received) {
  const make = negated => {
    const fail = message => {
      throw new Error(message);
    };

    const matcher = {
      get not() {
        return make(true);
      },

      get rejects() {
        return {
          toThrow(expected) {
            return (async () => {
              try {
                const result = received();
                if (result && typeof result.then === 'function') {
                  await result;
                }

                if (!negated) {
                  fail('rejects.toThrow: expected promise to reject but it resolved');
                }
              } catch (error) {
                const didMatch = errorMatches(error, expected);

                if (negated ? didMatch : !didMatch) {
                  fail(`rejects.toThrow: ${negated ? 'expected promise not to reject with' : 'received'} ${error.constructor.name}: ${error.message}`);
                }
              }
            })();
          },
        };
      },

      toBe(expected) {
        const isPass = Object.is(received, expected);
        if (isPass === negated) {
          fail(`toBe: received ${format(received)} but expected ${format(expected)}`);
        }
      },

      toEqual(expected) {
        const pass = isEqual(received, expected);
        if (pass === negated) {
          fail(`toEqual: ${format(received)} !== ${format(expected)}`);
        }
      },

      toStrictEqual(expected) {
        const pass = isEqual(received, expected);
        if (pass === negated) {
          fail(`toStrictEqual: ${format(received)} !== ${format(expected)}`);
        }
      },

      toBeUndefined() {
        const isPass = received === undefined;
        if (isPass === negated) {
          fail('toBeUndefined failed');
        }
      },

      toBeDefined() {
        const isPass = received !== undefined;
        if (isPass === negated) {
          fail('toBeDefined failed');
        }
      },

      toBeNull() {
        const isPass = received === null;
        if (isPass === negated) {
          fail('toBeNull failed');
        }
      },

      toBeTruthy() {
        const isPass = Boolean(received);
        if (isPass === negated) {
          fail('toBeTruthy failed');
        }
      },

      toBeFalsy() {
        const isPass = !received;
        if (isPass === negated) {
          fail('toBeFalsy failed');
        }
      },

      toBeInstanceOf(cls) {
        const isPass = received instanceof cls;
        if (isPass === negated) {
          fail(`toBeInstanceOf failed: ${format(received)} not instanceof ${cls?.name}`);
        }
      },

      toBeGreaterThan(n) {
        const isPass = received > n;
        if (isPass === negated) {
          fail('toBeGreaterThan failed');
        }
      },

      toBeLessThan(n) {
        const isPass = received < n;
        if (isPass === negated) {
          fail('toBeLessThan failed');
        }
      },

      toHaveLength(n) {
        const isPass = received.length === n;
        if (isPass === negated) {
          fail(`toHaveLength: expected ${n}, received length ${received?.length}`);
        }
      },

      toContain(item) {
        const pass = Array.isArray(received) ? received.includes(item) : String(received).includes(String(item));
        if (pass === negated) {
          fail(`toContain: ${format(received)} does not contain ${format(item)}`);
        }
      },

      toMatch(pattern) {
        const pass = pattern.test(format(received));
        if (pass === negated) {
          fail('toMatch failed');
        }
      },

      toHaveProperty(keyPath, value) {
        const keys = Array.isArray(keyPath) ? keyPath : String(keyPath).split('.');
        let object = received;
        let isPass = true;
        for (const key of keys) {
          if (object === null || object === undefined || !Object.hasOwn(object, key)) {
            isPass = false;
            break;
          }

          object = object[key];
        }

        if (isPass && value !== undefined) {
          isPass = isEqual(object, value);
        }

        if (isPass === negated) {
          fail(`toHaveProperty(${keyPath}) failed`);
        }
      },

      toHaveBeenCalled() {
        const isPass = callCountOf(received) > 0;
        if (isPass === negated) {
          fail('toHaveBeenCalled: expected function to have been called');
        }
      },

      toHaveBeenCalledTimes(n) {
        const count = callCountOf(received);
        const isPass = count === n;
        if (isPass === negated) {
          fail(`toHaveBeenCalledTimes: expected ${n} calls, received ${count}`);
        }
      },

      toHaveBeenCalledWith(...expectedArgs) {
        const pass = callsOf(received).some(call => argsEqual(call, expectedArgs));
        if (pass === negated) {
          fail('toHaveBeenCalledWith: no matching call');
        }
      },

      toHaveBeenLastCalledWith(...expectedArgs) {
        const calls = callsOf(received);
        const pass = calls.length > 0 && argsEqual(calls.at(-1), expectedArgs);
        if (pass === negated) {
          fail('toHaveBeenLastCalledWith failed');
        }
      },

      toThrow(expected) {
        let error;
        let isThrown = false;
        try {
          if (typeof received === 'function') {
            received();
          } else {
            throw received;
          }
        } catch (error_) {
          isThrown = true;
          error = error_;
        }

        const didMatch = isThrown && errorMatches(error, expected);

        if (didMatch === negated) {
          const thrown = isThrown ? `threw ${error.constructor.name}: ${error.message}` : 'did not throw';
          fail(`toThrow: ${negated ? 'expected not to throw' : 'expected to throw'} ${format(expected)} but ${thrown}`);
        }
      },

      toMatchSnapshot() {
        const pass = checkSnapshot(received);
        if (pass === negated) {
          fail('toMatchSnapshot failed');
        }
      },
    };

    for (const [name, matcherFn] of Object.entries(customMatchers)) {
      matcher[name] = (...args) => {
        const context = {
          isNot: negated,
          promise: 'resolved',
          utils: {
            matcherHint: () => '',
            printExpected: format,
            printReceived: format,
          },
        };
        const result = matcherFn.call(context, received, ...args);
        if (result && typeof result.then === 'function') {
          return result.then(result_ => {
            if (result_.pass !== negated) {
              return;
            }

            const message = typeof result_.message === 'function' ? result_.message() : result_.message;
            fail(String(message) || `${name} failed`);
          });
        }

        if (result.pass === negated) {
          const message = typeof result.message === 'function' ? result.message() : result.message;
          fail(String(message) || `${name} failed`);
        }
      };
    }

    return matcher;
  };

  return make(false);
}

expect.any = expectedType => new Any(expectedType);
expect.anything = () => new Anything();
expect.objectContaining = sample => new ObjectContaining(sample);
expect.arrayContaining = sample => new ArrayContaining(sample);
expect.stringMatching = sample => new StringMatching(sample);
expect.stringContaining = sample => new StringContaining(sample);
expect.hasAssertions = () => {};
expect.assertions = () => {};
const customMatchers = {};
expect.extend = matchers => Object.assign(customMatchers, matchers);
expect.addSnapshotSerializer = () => {};

// ---------------------------------------------------------------------------
// Custom matchers (visual regression + logger)
// ---------------------------------------------------------------------------
expect.extend({
  async toBeVisuallyEqualTo(receivedSVGPath, expectedPNGPath) {
    const options = {
      comment: 'SVG is equal to expected PNG',
      isNot: this.isNot,
      promise: this.promise,
    };

    const resultPNGPath = path.join(path.dirname(receivedSVGPath), path.basename(receivedSVGPath).replace('.svg', '.svg.png'));
    const {isEqual: isPngEqual, matched} = await compareSvg2Png(receivedSVGPath, resultPNGPath, expectedPNGPath);

    const expected = path.basename(receivedSVGPath);
    const received = path.basename(expectedPNGPath);

    const message = isPngEqual
      ? () => `${this.utils.matcherHint('toBeVisuallyEqualTo', undefined, undefined, options)
      }\n\n`
      + `Expected: not ${this.utils.printExpected(expected)}\n`
      + `Received: ${this.utils.printReceived(received)}`
      : () => `${this.utils.matcherHint('toBeVisuallyEqualTo', undefined, undefined, options)
      }\n\n`
      + `${this.utils.printReceived('Difference:')} ${expected} -> ${received}\n`
      + `Expected: ${this.utils.printExpected('no difference')}\n`
      + `Received: ${this.utils.printReceived(matched)} mismatches`;

    return {pass: isPngEqual, message};
  },

  async toBeVisuallyCorrectAsHTMLTo(receivedHTMLPath, expectedPNGPath) {
    const options = {
      comment: 'HTML is equal to expected PNG',
      isNot: this.isNot,
      promise: this.promise,
    };

    const {isEqual: isPngEqual, matched} = await compareHTML2Png(receivedHTMLPath, expectedPNGPath);

    const expected = path.basename(receivedHTMLPath);
    const received = path.basename(expectedPNGPath);

    const message = isPngEqual
      ? () => `${this.utils.matcherHint('toBeVisuallyCorrectAsHTMLTo', undefined, undefined, options)}\n\n`
        + `Expected: not ${this.utils.printExpected(expected)}\n`
        + `Received: ${this.utils.printReceived(received)}`
      : () => `${this.utils.matcherHint('toBeVisuallyCorrectAsHTMLTo', undefined, undefined, options)}\n\n`
        + `${this.utils.printReceived('Difference:')} ${expected} -> ${received}\n`
        + `Expected: ${this.utils.printExpected('no difference')}\n`
        + `Received: ${this.utils.printReceived(matched)} mismatches`;

    return {pass: isPngEqual, message};
  },

  toBeDefaultLogger(received) {
    const options = {
      comment: 'Object is default logger created by SVGSpriterConfig',
      isNot: this.isNot,
      promise: this.promise,
    };
    const pass = (
      isObject(received)
      && Array.isArray(received.transports)
      && received.transports.length === 1
    );

    return {
      pass,
      message: pass
        ? () => 'Is default logger, all OK'
        : () => `${this.utils.matcherHint('toBeDefaultLogger', undefined, undefined, options)}\n\n`
          + `Expected: ${this.utils.printExpected('default logger')}\n`
          + `Received: ${this.utils.printReceived(received)}`,
    };
  },
});

afterAll(closeBrowser);
// ---------------------------------------------------------------------------
// describe/it/test wrappers capturing names + files for snapshots
// ---------------------------------------------------------------------------
function currentFile() {
  const st = new Error('Unable to determine caller file').stack || '';
  // eslint-disable-next-line regexp/no-super-linear-move -- Stack trace matching is bounded by the fixed `.test.js:` suffix; not attacker-controlled.
  const m = st.match(/\((?<file>\S+\.test\.js):\d+:\d+\)/u) || st.match(/at (?<file>\S+\.test\.js)/u);
  if (!m) {
    return '';
  }

  try {
    return m.groups.file.startsWith('file:') ? fileURLToPath(m.groups.file) : m.groups.file;
  } catch {
    return m.groups.file;
  }
}

function describe(name, fn) {
  if (Array.isArray(name) || (Array.isArray(name))) {
    return describe.each(name)(fn);
  }

  describeStack.push(typeof name === 'string' ? name : String(name));
  try {
    return _describe(name, fn);
  } finally {
    describeStack.pop();
  }
}

function it(name, fn, options) {
  currentTestFile = currentFile() || currentTestFile;
  const key = [...describeStack, typeof name === 'string' ? name : 'test'].filter(Boolean).join(' > ');
  const wrapped = (...args) => {
    currentTestName = typeof name === 'string' ? name : 'test';
    currentSnapshotKey = key;
    if (typeof fn === 'function') {
      if (fn.length > 0) {
        return new Promise((resolve, reject) => {
          const done = error => (error ? reject(error) : resolve());
          try {
            fn.call(this, done, ...args);
          } catch (error) {
            reject(error);
          }
        });
      }

      return fn(...args);
    }

    return undefined;
  };

  return _it(name, wrapped, options);
}

function test(name, fn, options) {
  return it(name, fn, options);
}

// It.each / describe.each
it.each = describeEach('it');
describe.each = describeEach('describe');
test.each = describeEach('it');

function describeEach(kind) {
  return function (table, ...values) {
    if (Array.isArray(table) && !('raw' in table)) {
      const rows = table;
      return (title, fn) => {
        for (const row of rows) {
          const name = interpolateTitle(title, Array.isArray(row) ? row : [row]);
          if (kind === 'describe') {
            describe(name, () => fn(...(Array.isArray(row) ? row : [row])));
          } else {
            it(name, () => fn(...(Array.isArray(row) ? row : [row])));
          }
        }
      };
    }

    // Tagged template form: table is the strings object, values the interpolations
    const placeholders = values.map((_, i) => `\u{0}VAL${i}\u{0}`);
    let full = table.raw[0];
    for (let i = 0; i < values.length; i++) {
      full += placeholders[i] + table.raw[i + 1];
    }

    const lines = full.split('\n').map(l => l.trim()).filter(Boolean);
    const headerLine = lines[0];
    const colNames = headerLine.split('|').map(s => s.trim()).filter(Boolean);

    const resolveCell = cell => {
      const m = cell.trim().match(/^\0VAL(?<val>\d+)\0$/u);
      if (m) {
        return values[Number(m.groups.val)];
      }

      return cell.trim();
    };

    const rowOf = line => {
      let cells = line.split('|');
      if (cells[0].trim() === '') {
        cells = cells.slice(1);
      }

      if (cells.length > 0 && cells.at(-1).trim() === '') {
        cells = cells.slice(0, -1);
      }

      return cells.map(cell => resolveCell(cell));
    };

    return (title, fn) => {
      for (const dataLine of lines.slice(1)) {
        const row = rowOf(dataLine);
        if (row.every(cell => ['', null, undefined].includes(cell))) {
          continue;
        }

        const objectArgs = {};
        for (const [index, colName] of colNames.entries()) {
          objectArgs[colName.trim()] = row[index];
        }

        const name = interpolateTitle(title, objectArgs);
        if (kind === 'describe') {
          describe(name, () => fn(objectArgs));
        } else {
          it(name, () => fn(objectArgs));
        }
      }
    };
  };
}

function interpolateTitle(title, values) {
  let out = title;
  let i = 0;
  out = out.replaceAll(/%[dijnops]/gu, () => {
    const v = Array.isArray(values) ? values[i++] : undefined;
    return String(v);
  });
  if (!Array.isArray(values)) {
    // eslint-disable-next-line max-params -- Full String#replaceAll callback signature is required to access the named-match `groups` argument.
    out = out.replaceAll(/\$(?<name>\w+)/gu, (m, _name, _offset, _string, groups) => {
      const v = values[groups.name];
      return v === undefined ? m : String(v);
    });
  }

  return out;
}

export {
  makeMock,
  expect,
  describe,
  it,
  test,

  beforeAll,
  afterAll,
};

export {makeMock as createMock, spyOn, restoreAllMocks};

export {
  beforeEach, before, afterEach, after,
} from 'node:test';
