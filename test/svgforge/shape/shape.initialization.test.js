
import {Buffer} from 'node:buffer';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import File from 'vinyl';
import getShape from '../../../lib/svgforge/shape/index.js';
import SVGSpriter from '../../../lib/svgforge.js';
import {setDependency} from '../../../lib/deps.js';
import ArgumentError from '../../../lib/svgforge/errors/argument-error.js';
import {
  beforeEach,
  createMock,
  describe,
  expect,
  it,
} from '../../helpers/harness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mockFixXMLString = createMock();
setDependency('fixXMLString', mockFixXMLString);

const TEST_SVG = `<svg viewBox="0 0
                                16 16"></svg>`;
const FIXED_TEST_SVG = '<svg viewBox="0 0 16 16"></svg>';

describe('testing SVGShape initialization', () => {
  let spriter;

  beforeEach(() => {
    mockFixXMLString.mockReset();
    spriter = new SVGSpriter({
      shape: {
        dest: 'svg',
      },
    });
  });

  it('should not throw an error and should call fixXMLString if fixXMLString is not throwing error', () => {
    expect.hasAssertions();

    mockFixXMLString.mockReturnValueOnce(FIXED_TEST_SVG);

    expect(() => {
      getShape(new File({
        path: __dirname,
        contents: Buffer.from(TEST_SVG),
      }), spriter);
    }).not.toThrow(ArgumentError);
    expect(mockFixXMLString).toHaveBeenCalledWith(TEST_SVG);
  });

  it('should throw error and should call fixXMLString if fixXMLString is throwing error', () => {
    expect.hasAssertions();

    mockFixXMLString.mockImplementation(() => {
      throw new Error('some error');
    });

    expect(() => {
      getShape(new File({
        path: __dirname,
        contents: Buffer.from(TEST_SVG),
      }), spriter);
    }).toThrow(new ArgumentError('Invalid SVG file (some error)'));
    expect(mockFixXMLString).toHaveBeenCalledWith(TEST_SVG);
  });

  it('should throw an error and should call fixXMLString on non-svg files', () => {
    expect.hasAssertions();

    const TEST_NON_SVG = '<div class="test">123</div>';

    expect(() => {
      getShape(new File({
        path: __dirname,
        contents: Buffer.from(TEST_NON_SVG),
      }), spriter);
    }).toThrow(ArgumentError);
    expect(mockFixXMLString).toHaveBeenCalledWith(TEST_NON_SVG);
  });

  it('should not throw an error and should not call fixXMLString on actual valid svg files', () => {
    expect.hasAssertions();

    const cwd = path.join(__dirname, '../../fixture/svg/single');
    const weatherFiles = fs.globSync('**/weather*.svg', {cwd}).toSorted((a, b) => b.localeCompare(a));

    expect.assertions(weatherFiles.length * 2);

    for (const weatherFile of weatherFiles) {
      const svgFileBuffer = fs.readFileSync(path.join(cwd, weatherFile));

      expect(() => {
        getShape(new File({
          path: __dirname,
          contents: svgFileBuffer,
        }), spriter);
      }).not.toThrow(ArgumentError);
      expect(mockFixXMLString).not.toHaveBeenCalled();
    }
  });
});
