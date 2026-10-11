import path from 'node:path';
import {fileURLToPath} from 'node:url';
import SVGSpriter from '../../lib/svgforge.js';
import {addFixtureFiles} from '../helpers/add-files.js';
import {paths} from '../helpers/constants.js';
import removeTmpPath from '../helpers/remove-temp-path.js';
import {
  beforeAll,
  describe,
  expect,
  it,
} from '../helpers/harness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('svg-sprite: layouter fileSize data', () => {
  const temporaryPath = path.join(paths.tmp, 'layouter-filesize');
  let fixtest = '';

  beforeAll(async () => {
    await removeTmpPath(temporaryPath);
    fixtest = path.join(__dirname, '../fixture/svg/single/weather-clear.svg');
  });

  it('renders the file size when a mode enables the example', async () => {
    expect.hasAssertions();

    const spriter = new SVGSpriter({dest: temporaryPath});
    addFixtureFiles(spriter, ['weather-clear.svg'], path.dirname(fixtest));

    const {data} = await spriter.compileAsync({
      stack: {
        sprite: 'svg/sprite.svg',
        render: {
          css: true,
        },
        example: true,
      },
    });

    expect(data.stack.shapes).toHaveLength(1);
    expect(data.stack.shapes[0].fileSize).toMatch(/^\d+(?:\.\d+)? kB$/u);
  });

  it('leaves the file size empty when no mode enables the example', async () => {
    expect.hasAssertions();

    const spriter = new SVGSpriter({dest: temporaryPath});
    addFixtureFiles(spriter, ['weather-clear.svg'], path.dirname(fixtest));

    const {data} = await spriter.compileAsync({
      stack: {
        sprite: 'svg/sprite.svg',
        render: {
          css: true,
        },
      },
    });

    expect(data.stack.shapes).toHaveLength(1);
    expect(data.stack.shapes[0].fileSize).toBeNull();
  });

  it('renders a copy button for each shape in the HTML example', async () => {
    expect.hasAssertions();

    const spriter = new SVGSpriter({dest: temporaryPath});
    addFixtureFiles(spriter, ['weather-clear.svg'], path.dirname(fixtest));

    const {result} = await spriter.compileAsync({
      defs: {
        sprite: 'svg/sprite.svg',
        example: true,
      },
    });

    const html = result.defs.example.contents.toString('utf8');

    expect(html).toContain('data-copy-label="Copy ID"');
    expect(html).toContain('data-copy="weather-clear"');
    expect(html).toContain('<button type="button" class="copy" data-copy="weather-clear" data-copy-label="Copy ID">Copy ID</button>');
  });
});
