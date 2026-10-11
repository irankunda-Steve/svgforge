import path from 'node:path';
import {fileURLToPath} from 'node:url';
import SVGSpriter from '../../lib/svgforge.js';
import {addFixtureFiles} from '../helpers/add-files.js';
import {constants} from '../helpers/test-configs.js';
import {paths} from '../helpers/constants.js';
import removeTmpPath from '../helpers/remove-temp-path.js';
import {
  describe,
  expect,
  it,
} from '../helpers/harness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_CONFIG = constants.DEFAULT;
const temporaryPath = path.join(paths.tmp, 'custom-template');
const customTemplate = path.join(__dirname, '../fixture/templates/custom-example.vto');
const customDest = 'custom.html';

describe('custom templates', () => {
  it('should render the HTML example with a custom Vento template', async () => {
    expect.hasAssertions();

    await removeTmpPath(temporaryPath);

    const spriter = new SVGSpriter({dest: temporaryPath});
    addFixtureFiles(spriter, TEST_CONFIG.files, TEST_CONFIG.cwd);

    const {result} = await spriter.compileAsync({
      defs: {
        sprite: 'svg/sprite.defs.svg',
        example: {
          template: customTemplate,
          dest: customDest,
        },
      },
    });

    const exampleOutput = result.defs.example.contents.toString();

    expect(result.defs.example.path).toStrictEqual(path.join(temporaryPath, 'defs', customDest));
    expect(exampleOutput).toContain('<title>defs custom example</title>');
    expect(exampleOutput).toContain('<ul>');
    expect(exampleOutput).toContain('<li title="weather-clear">');
    expect(exampleOutput).toContain('<li title="weather-storm~hover">');
    expect(exampleOutput).toContain('<svg viewBox="0 0 48 48">');
    expect(exampleOutput).toContain('<use href="svg/sprite.defs.svg#weather-clear"/>');
  });

  it('should default to the built-in sprite.vto template when example is true', async () => {
    expect.hasAssertions();

    await removeTmpPath(temporaryPath);

    const spriter = new SVGSpriter({dest: temporaryPath});
    addFixtureFiles(spriter, TEST_CONFIG.files, TEST_CONFIG.cwd);

    const {result} = await spriter.compileAsync({
      defs: {
        sprite: 'svg/sprite.defs.svg',
        example: true,
      },
    });

    const exampleOutput = result.defs.example.contents.toString();

    expect(exampleOutput).toContain('<h1>SVG <code>&lt;defs&gt;</code> sprite preview (external)</h1>');
    expect(exampleOutput).toContain('<figcaption');
    expect(exampleOutput).toContain('Copy ID');
  });
});
