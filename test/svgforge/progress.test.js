import path from 'node:path';
import {fileURLToPath} from 'node:url';
import SVGSpriter from '../../lib/svgforge.js';
import {addFixtureFiles} from '../helpers/add-files.js';
import {constants} from '../helpers/test-configs.js';
import {paths} from '../helpers/constants.js';
import removeTmpPath from '../helpers/remove-temp-path.js';
import {
  createMock,
  describe,
  expect,
  it,
} from '../helpers/harness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_CONFIG = constants.DEFAULT;
const temporaryPath = path.join(paths.tmp, 'progress');

describe('progress events', () => {
  it('should emit one progress event per processed shape with processed/total', async () => {
    expect.hasAssertions();

    await removeTmpPath(temporaryPath);

    const spriter = new SVGSpriter({dest: temporaryPath});
    const progress = createMock();
    spriter.on('progress', progress);

    addFixtureFiles(spriter, TEST_CONFIG.files, TEST_CONFIG.cwd);
    const expectedTotal = TEST_CONFIG.files.length;

    await new Promise((resolve, reject) => {
      spriter.compile(error => error ? reject(error) : resolve());
    });

    expect(progress).toHaveBeenCalledTimes(expectedTotal);

    const {calls} = progress.mock;
    let lastProcessed = 0;
    for (const call of calls) {
      const {processed, total} = call[0];
      expect(processed).toBe(lastProcessed + 1);
      expect(processed <= total).toBe(true);
      expect(total <= expectedTotal).toBe(true);
      lastProcessed = processed;
    }

    // After all shapes are added, the final event reports the full total
    const last = calls.at(-1)[0];
    expect(last.processed).toBe(expectedTotal);
    expect(last.total).toBe(expectedTotal);
  });

  it('should not emit progress when no shapes are added', async () => {
    expect.hasAssertions();

    await removeTmpPath(temporaryPath);

    const spriter = new SVGSpriter({dest: temporaryPath});
    const progress = createMock();
    spriter.on('progress', progress);

    await new Promise((resolve, reject) => {
      spriter.compile(error => error ? reject(error) : resolve());
    });

    expect(progress).not.toHaveBeenCalled();
  });
});
