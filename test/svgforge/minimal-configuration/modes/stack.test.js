
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {renderTemplate} from '../../../../lib/svgforge/utils/template.js';
import SVGSpriter from '../../../../lib/svgforge.js';
import {isResvgAvailable} from '../../../../lib/svgforge/utils/index.js';
import {addFixtureFiles} from '../../../helpers/add-files.js';
import writeFiles from '../../../helpers/write-files.js';
import writeFile from '../../../helpers/write-file.js';
import {constants} from '../../../helpers/test-configs.js';
import {paths} from '../../../helpers/constants.js';
import removeTmpPath from '../../../helpers/remove-temp-path.js';
import {
  beforeAll,
  describe,
  expect,
  it,
} from '../../../helpers/jest-compat.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe.each`
        name          | testConfigKey
        ${'default'}  | ${'DEFAULT'}
        ${'w/o dims'} | ${'WITHOUT_DIMS'}
`('svg-sprite: $name: «stack» mode', ({testConfigKey}) => {
  const testConfig = constants[testConfigKey];

  // Dimension-less icons can only be sized by the optional `@resvg/resvg-js`
  // fallback. Without it the shapes are skipped, so the visual expectations
  // only make sense while the fallback is installed (the skip warning itself
  // is covered by shape.dimension-fallback.test.js).
  const requiresDimensionFallback = testConfigKey === 'WITHOUT_DIMS' && !isResvgAvailable();

  const temporaryPath = path.join(paths.tmp, `stack${testConfig.namespace}`);

  let svg;
  let spriter;
  let data;

  beforeAll(async () => {
    if (requiresDimensionFallback) {
      return;
    }

    await removeTmpPath(temporaryPath);
    data = {};

    spriter = new SVGSpriter({dest: temporaryPath});
    addFixtureFiles(spriter, testConfig.files, testConfig.cwd);
    const {result, data: cssData} = await spriter.compileAsync({
      stack: {
        sprite: `svg/stack${testConfig.namespace}.svg`, render: {
          css: true,
        },
      },
    });
    writeFiles(result);
    data = cssData.stack;
    svg = path.basename(result.stack.sprite.path);
  });

  it('creates a visually correct stylesheet resource in CSS format', async () => {
    // The visual expectation needs the optional `@resvg/resvg-js` fallback
    // (see `requiresDimensionFallback`); without it the fixture shapes are
    // skipped, which is covered by shape.dimension-fallback.test.js.
    if (requiresDimensionFallback) {
      return;
    }

    expect.hasAssertions();

    data.svg = await readFile(path.join(temporaryPath, 'stack/svg', svg), 'utf8');
    data.css = '../sprite.css';

    expect(data.svg).toMatchSnapshot();

    const out = await renderTemplate(path.join(__dirname, '../../../tmpl/stack.vto'), data);
    const preview = await writeFile(path.join(temporaryPath, `stack/html/stack${testConfig.namespace}.html`), out);
    const expected = path.join(paths.expectations, `png/stack${testConfig.namespace}.html.png`);

    await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
  });
});

describe('without viewbox', () => {
  const testConfig = constants.WITHOUT_DIMS;
  const temporaryPath = path.join(paths.tmp, 'stack-without-viewbox');

  const requiresDimensionFallback = !isResvgAvailable();
  let svg;
  let spriter;
  let data;

  beforeAll(async () => {
    if (requiresDimensionFallback) {
      return;
    }

    await removeTmpPath(temporaryPath);
    data = {};

    spriter = new SVGSpriter({dest: temporaryPath});
    addFixtureFiles(spriter, testConfig.files, testConfig.cwd);
    const {result, data: cssData} = await spriter.compileAsync({
      stack: {
        sprite: `svg/stack${testConfig.namespace}.svg`, render: {
          css: true,
        },
        rootviewbox: false,
      },
    });
    writeFiles(result);
    data = cssData.stack;
    svg = path.basename(result.stack.sprite.path);
  });

  it('creates a visually correct stylesheet resource in CSS format', async () => {
    // The visual expectation needs the optional `@resvg/resvg-js` fallback
    // (see `requiresDimensionFallback`); without it the fixture shapes are
    // skipped, which is covered by shape.dimension-fallback.test.js.
    if (requiresDimensionFallback) {
      return;
    }

    expect.hasAssertions();

    data.svg = await readFile(path.join(temporaryPath, 'stack/svg', svg), 'utf8');
    data.css = '../sprite.css';

    expect(data.svg).toMatchSnapshot();

    const out = await renderTemplate(path.join(__dirname, '../../../tmpl/stack.vto'), data);
    const preview = await writeFile(path.join(temporaryPath, 'stack/html/stack-without-viewbox.html'), out);
    const expected = path.join(paths.expectations, 'png/stack-without-viewbox.html.png');

    await expect(preview).toBeVisuallyCorrectAsHTMLTo(expected);
  });
});
