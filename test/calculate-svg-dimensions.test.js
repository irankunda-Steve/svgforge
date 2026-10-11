
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import calculateSvgDimensions, {isResvgAvailable} from '../lib/svgforge/utils/calculate-svg-dimensions.js';
import {setDependency, resetDependencies} from '../lib/deps.js';
import DimensionsCalculationError from '../lib/svgforge/errors/dimensions-calculation-error.js';
import {
  describe,
  expect,
  it,
  createMock,
} from './helpers/jest-compat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 Create a mock `@resvg/resvg-js` package whose `Resvg` class reports the given
 rendered dimensions. Used to exercise the dimension-calculation wiring while
 the optional package itself is not installed.

 @param {number} width Reported width
 @param {number} height Reported height
 @returns {object} Mock package module
 */
const createMockResvgPackage = (width, height) => ({
  Resvg: class {
    constructor(svg, options) {
      this.svg = svg;
      this.options = options;
      this.width = width;
      this.height = height;
    }
  },
});

describe('calculateSvgDimensions', () => {
  it('should return the expected dimensions from 46x46 fixture', async () => {
    expect.hasAssertions();

    setDependency('@resvg/resvg-js', createMockResvgPackage(46, 46));

    const svgFilePath = path.join(__dirname, 'fixture/svg/special/without-dims/46x46.svg');
    const svg = await readFile(svgFilePath, 'utf8');
    const dimensions = calculateSvgDimensions(svg);
    const expected = {width: 46, height: 46};

    expect(dimensions).toStrictEqual(expected);
  });

  it('should return the expected dimensions from 2048x2048 fixture', async () => {
    expect.hasAssertions();

    setDependency('@resvg/resvg-js', createMockResvgPackage(2048, 2048));

    const svgFilePath = path.join(__dirname, 'fixture/svg/special/without-dims/2048x2048.svg');
    const svg = await readFile(svgFilePath, 'utf8');
    const dimensions = calculateSvgDimensions(svg);
    const expected = {width: 2048, height: 2048};

    expect(dimensions).toStrictEqual(expected);
  });

  it('should return the expected dimensions from 32x32 fixture', async () => {
    expect.hasAssertions();

    setDependency('@resvg/resvg-js', createMockResvgPackage(32, 32));

    const svgFilePath = path.join(__dirname, 'fixture/svg/special/without-dims/32x32.svg');
    const svg = await readFile(svgFilePath, 'utf8');
    const dimensions = calculateSvgDimensions(svg);
    const expected = {width: 32, height: 32};

    expect(dimensions).toStrictEqual(expected);
  });

  it('should return the expected dimensions from 100x100 fixture', async () => {
    expect.hasAssertions();

    setDependency('@resvg/resvg-js', createMockResvgPackage(100, 100));

    const svgFilePath = path.join(__dirname, 'fixture/svg/special/without-dims/100x100.svg');
    const svg = await readFile(svgFilePath, 'utf8');
    const dimensions = calculateSvgDimensions(svg);
    const expected = {width: 100, height: 100};

    expect(dimensions).toStrictEqual(expected);
  });

  it('should return the expected dimensions from 231x69 fixture', async () => {
    expect.hasAssertions();

    setDependency('@resvg/resvg-js', createMockResvgPackage(231, 69));

    const svgFilePath = path.join(__dirname, 'fixture/svg/special/without-dims/231x69.svg');
    const svg = await readFile(svgFilePath, 'utf8');
    const dimensions = calculateSvgDimensions(svg);
    const expected = {width: 231, height: 69};

    expect(dimensions).toStrictEqual(expected);
  });

  it('should return same results no each run', async () => {
    expect.hasAssertions();

    setDependency('@resvg/resvg-js', createMockResvgPackage(46, 46));

    const svgFilePath = path.join(__dirname, 'fixture/svg/special/without-dims/46x46.svg');
    const svg = await readFile(svgFilePath, 'utf8');

    const firstRunDimensions = calculateSvgDimensions(svg);
    const secondRunDimensions = calculateSvgDimensions(svg);
    const thirdRunDimensions = calculateSvgDimensions(svg);

    expect(firstRunDimensions).toStrictEqual(secondRunDimensions);
    expect(thirdRunDimensions).toStrictEqual(secondRunDimensions);
  });

  it('should throw error if error occurred', () => {
    expect.hasAssertions();

    setDependency('@resvg/resvg-js', {
      Resvg: createMock().mockImplementationOnce(() => {
        throw new Error('test');
      }),
    });

    try {
      expect(() => {
        calculateSvgDimensions('');
      }).toThrow(DimensionsCalculationError);
    } finally {
      resetDependencies();
    }
  });

  it('should report the optional package as missing when it is not installed', () => {
    expect.hasAssertions();

    // The optional package is no longer a dev dependency, so a default
    // install has no dimension fallback available.
    expect(isResvgAvailable()).toBe(false);
  });

  it('should throw error if the optional package is not installed', () => {
    expect.hasAssertions();

    setDependency('@resvg/resvg-js', {});

    try {
      expect(() => {
        calculateSvgDimensions('');
      }).toThrow(/not installed.*npm install @resvg\/resvg-js/u);
    } finally {
      resetDependencies();
    }
  });
});
