
import {Buffer} from 'node:buffer';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DOMParser} from '@xmldom/xmldom';
import SVGSpriter from '../lib/svgforge.js';
import {setDependency} from '../lib/deps.js';
import {
  describe,
  expect,
  it,
  jest,
} from './helpers/jest-compat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mockCalc = jest.fn();
setDependency('calculate-svg-dimensions', mockCalc);

const expectations = [{
  svg: '46x46.svg',
  result: {
    width: 46,
    height: 46,
  },
}, {
  svg: '2048x2048.svg',
  result: {
    width: 2048,
    height: 2048,
  },
}];

const TEST_SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

describe('testing shapes', () => {
  it.each`
            svg                    | dimension
            ${expectations[0].svg} | ${expectations[0].result}
            ${expectations[1].svg} | ${expectations[1].result}
        `('should call calculateSvgDimensions if the $svg does not contain viewBox or height/width properties ($dimension)', async ({
    svg, dimension,
  }) => {
    expect.hasAssertions();

    const spriter = new SVGSpriter({
      shape: {
        dest: 'svg',
        dimension: {
          maxWidth: 4000,
          maxHeight: 4000,
        },
      },
    });

    mockCalc.mockReturnValueOnce(dimension);

    const svgFilePath = path.join(__dirname, `fixture/svg/special/without-dims/${svg}`);

    spriter.add(svgFilePath, svg, Buffer.from(TEST_SVG));

    expect(mockCalc).toHaveBeenCalledWith(new DOMParser().parseFromString(`<?xml version="1.0" encoding="utf-8"?>${TEST_SVG}`, 'image/svg+xml').toString());

    const {result} = await spriter.compileAsync();

    expect(result).toBeInstanceOf(Object);
    expect(result.shapes).toBeInstanceOf(Array);

    const dom = new DOMParser().parseFromString(result.shapes[0]._contents.toString(), 'text/xml');

    expect(dom.documentElement.getAttribute('height')).toBe(dimension.height.toString());
    expect(dom.documentElement.getAttribute('width')).toBe(dimension.width.toString());
  });

  it('should skip a shape whose dimensions cannot be calculated instead of emitting NaN viewBox values', async () => {
    expect.hasAssertions();

    const spriter = new SVGSpriter({
      shape: {
        dest: 'svg',
        dimension: {
          maxWidth: 4000,
          maxHeight: 4000,
        },
      },
    });

    mockCalc.mockImplementationOnce(() => {
      throw new Error('Dimension calculation failed');
    });

    const svgFilePath = path.join(__dirname, 'fixture/svg/special/without-dims/46x46.svg');
    spriter.add(svgFilePath, '46x46.svg', Buffer.from(TEST_SVG));

    const {result} = await spriter.compileAsync();

    expect(result).toBeInstanceOf(Object);
    expect(result.shapes).toStrictEqual([]);
  });
});
