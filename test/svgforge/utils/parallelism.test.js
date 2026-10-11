import {coreCount, shapeConcurrency, svgoWorkerCount} from '../../../lib/svgforge/utils/parallelism.js';
import {
  describe,
  expect,
  it,
} from '../../helpers/jest-compat.js';

describe('testing coreCount()', () => {
  it('should never report less than one core', () => {
    expect.hasAssertions();

    expect(coreCount(0)).toBe(1);
    expect(coreCount(1)).toBe(1);
    expect(coreCount(8)).toBe(8);
  });
});

describe('testing svgoWorkerCount()', () => {
  it('should leave one core for the main thread', () => {
    expect.hasAssertions();

    expect(svgoWorkerCount(1)).toBe(1);
    expect(svgoWorkerCount(2)).toBe(1);
    expect(svgoWorkerCount(4)).toBe(3);
    expect(svgoWorkerCount(16)).toBe(15);
  });
});

describe('testing shapeConcurrency()', () => {
  it('should pin the concurrency to the cores with a floor of four', () => {
    expect.hasAssertions();

    expect(shapeConcurrency(1)).toBe(4);
    expect(shapeConcurrency(2)).toBe(4);
    expect(shapeConcurrency(4)).toBe(4);
    expect(shapeConcurrency(8)).toBe(8);
    expect(shapeConcurrency(16)).toBe(16);
  });

  it('should never starve the worker pool', () => {
    expect.hasAssertions();

    for (const cores of [1, 2, 4, 8, 16, 64]) {
      expect(shapeConcurrency(cores) >= svgoWorkerCount(cores)).toBe(true);
    }
  });
});
