import {Buffer} from 'node:buffer';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import SVGSpriter from '../../../lib/svgforge.js';
import DimensionsCalculationError from '../../../lib/svgforge/errors/dimensions-calculation-error.js';
import {isResvgAvailable} from '../../../lib/svgforge/utils/calculate-svg-dimensions.js';
import {
  createMock,
  describe,
  expect,
  it,
} from '../../helpers/harness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

describe('dimension fallback without @resvg/resvg-js', () => {
  it('should warn with an install hint and skip a shape without dimensions when the fallback is unavailable', async () => {
    // The real fallback path can only be exercised while the optional package
    // is not installed. The package is no longer a dev dependency, so this
    // test runs by default; it self-skips in environments that installed it
    // manually on top of the dev dependencies.
    if (isResvgAvailable()) {
      return;
    }

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

    // Capture the warning the queue emits for the skipped shape
    spriter.warn = createMock();

    // The queue also signals the skip as a structured event on the spriter
    const onSkipped = createMock();
    spriter.on('shape-skipped', onSkipped);

    const svgFilePath = path.join(__dirname, '../../fixture/svg/special/without-dims/46x46.svg');
    spriter.add(svgFilePath, '46x46.svg', Buffer.from(TEST_SVG));

    const {result} = await spriter.compileAsync();

    expect(spriter.warn).toHaveBeenCalled();
    expect(spriter.warn.mock.calls[0][0]).toBe('Skipping "%s" (%s)');
    expect(spriter.warn.mock.calls[0][2]).toContain('npm install @resvg/resvg-js');
    expect(spriter._dimensionSkipped).toBe(1);
    expect(result.shapes).toStrictEqual([]);

    expect(onSkipped).toHaveBeenCalled();
    expect(onSkipped.mock.calls[0][0].file).toBe('46x46');
    expect(onSkipped.mock.calls[0][0].error instanceof DimensionsCalculationError).toBe(true);
    expect(onSkipped.mock.calls[0][0].error.message).toContain('npm install @resvg/resvg-js');
  });
});
