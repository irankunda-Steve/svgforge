import path from 'node:path';
import SVGSpriter from '../../../lib/svgforge.js';
import {addFixtureFiles} from '../../helpers/add-files.js';
import {constants} from '../../helpers/test-configs.js';
import {paths} from '../../helpers/constants.js';
import removeTmpPath from '../../helpers/remove-temp-path.js';
import {
  beforeAll,
  describe,
  expect,
  it,
} from '../../helpers/harness.js';

const temporaryPath = paths.tmp + '/view';

describe('svg-sprite: «view» mode', () => {
  const testConfig = constants.DEFAULT;

  let spriter;
  let result;
  let data;
  let svg;

  beforeAll(async () => {
    await removeTmpPath(temporaryPath);

    spriter = new SVGSpriter({dest: temporaryPath});
    addFixtureFiles(spriter, testConfig.files, testConfig.cwd);
    ({result, data} = await spriter.compileAsync({
      view: {
        sprite: 'svg/sprite.view.svg',
        bust: false,
        render: {
          css: true,
        },
      },
    }));

    svg = result.view.sprite.contents.toString('utf8');
  });

  it('composes the sprite from <view> elements and embedded shapes', () => {
    expect.hasAssertions();

    const [firstView, ...rest] = svg.split('<view').slice(1);

    expect(svg).toContain('<svg ');
    expect(firstView).toContain('id="weather-clear"');
    expect(firstView).toMatch(/viewBox="0 0 \d+ \d+"\/>/u);
    expect(rest.length).toBeGreaterThan(0);
  });

  it('adds the sprite dimensions to the root <svg> element', () => {
    expect.hasAssertions();

    expect(svg).toMatch(/<svg[^>]*viewBox="0 0 \d+ \d+"/u);
    expect(svg).toMatch(new RegExp(`width="${data.view.spriteWidth}"`, 'u'));
    expect(svg).toMatch(new RegExp(`height="${data.view.spriteHeight}"`, 'u'));
  });

  it('exposes the shape dimensions selectors', () => {
    expect.hasAssertions();

    expect(data.view.shapes[0].selector.dimensions).toStrictEqual([{
      expression: '.svg-weather-clear-dims',
      raw: '.svg-weather-clear-dims',
      first: true,
      last: true,
    }]);
  });

  it('renders the dimensions stylesheet resource', () => {
    expect.hasAssertions();

    const css = result.view.css.contents.toString('utf8');
    expect(path.extname(result.view.css.path)).toBe('.css');
    expect(css).toContain('.svg-weather-clear-dims');
  });

  it('supports a dimensions configuration containing "%s"', async () => {
    expect.hasAssertions();

    const variantSpriter = new SVGSpriter({dest: temporaryPath});
    addFixtureFiles(variantSpriter, testConfig.files, testConfig.cwd);
    const {result: variant} = await variantSpriter.compileAsync({
      view: {
        sprite: 'svg/sprite.view.svg',
        bust: false,
        dimensions: '%s-size',
        render: {
          css: true,
        },
      },
    });

    const css = variant.view.css.contents.toString('utf8');
    expect(css).toContain('.svg-weather-clear-size');
  });
});
