import path from 'node:path';
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

const TEST_CONFIG = constants.DEFAULT;
const temporaryPath = path.join(paths.tmp, 'preview-layouts');

/**
 Render the HTML example for a single mode

 @param {string} mode Sprite mode
 @param {object} modeConfig Mode configuration
 @returns {Promise<string>} Rendered example document
 */
async function renderExample(mode, modeConfig) {
  await removeTmpPath(temporaryPath);

  const spriter = new SVGSpriter({dest: temporaryPath});
  addFixtureFiles(spriter, TEST_CONFIG.files, TEST_CONFIG.cwd);

  const {result} = await spriter.compileAsync({
    [mode]: {
      sprite: `svg/sprite.${mode}.svg`,
      example: true,
      ...modeConfig,
    },
  });

  return result[mode].example.contents.toString();
}

describe('preview layouts', () => {
  it('should use the external layout by default', async () => {
    expect.hasAssertions();

    const exampleOutput = await renderExample('defs', {});

    expect(exampleOutput).toContain('directory URL ending in a slash');
    expect(exampleOutput).toContain('<use href="svg/sprite.defs.svg#weather-clear"></use>');
    expect(exampleOutput).not.toContain('This is an inlined version of the generated SVG sprite');
    expect(exampleOutput).not.toContain('Inline SVG');
    expect(exampleOutput).not.toContain('inline SVG');
    expect(exampleOutput).toContain('<h1>SVG <code>&lt;defs&gt;</code> sprite preview (external)</h1>');
  });

  it('should use the inline layout when inline is enabled', async () => {
    expect.hasAssertions();

    const exampleOutput = await renderExample('defs', {inline: true});

    expect(exampleOutput).toContain('This is an inlined version of the generated SVG sprite');
    expect(exampleOutput).toContain('<use href="#weather-clear"></use>');
    expect(exampleOutput).toContain('The embedded sprite slightly differs');
    expect(exampleOutput).not.toContain('directory URL ending in a slash');
    expect(exampleOutput).toContain('<h3>Inline SVG with <code>&lt;use&gt;</code> references</h3>');
    expect(exampleOutput).toContain('<h3>Inline SVG, sized by viewBox only (stacksvg-style)</h3>');
    expect(exampleOutput).toContain('<h1>SVG <code>&lt;defs&gt;</code> sprite preview (inline)</h1>');
  });

  it('should render section headings without letter prefixes or inline wording', async () => {
    expect.hasAssertions();

    const exampleOutput = await renderExample('defs', {});

    expect(exampleOutput).toContain('<h3>SVG with <code>&lt;use&gt;</code> references</h3>');
    expect(exampleOutput).toContain('<h3>SVG, sized by viewBox only (stacksvg-style)</h3>');
    expect(exampleOutput).not.toContain('A) ');
    expect(exampleOutput).not.toContain('B) ');
    expect(exampleOutput).not.toContain('C) ');
  });

  it('should render the symbol preview with the inline layout', async () => {
    expect.hasAssertions();

    const exampleOutput = await renderExample('symbol', {inline: true});

    expect(exampleOutput).toContain('<use href="#weather-clear"></use>');
    expect(exampleOutput).toContain('<h1>SVG <code>&lt;symbol&gt;</code> sprite preview (inline)</h1>');
    expect(exampleOutput).not.toContain('A) ');
  });

  it('should render the stack preview with all three sections', async () => {
    expect.hasAssertions();

    const exampleOutput = await renderExample('stack', {});

    expect(exampleOutput).toContain('<h3>SVG stack</h3>');
    expect(exampleOutput).toContain('<h3>SVG, sized by viewBox only (stacksvg-style)</h3>');
    expect(exampleOutput).toContain('<h3>Sprite as CSS background image (inline style)</h3>');
    expect(exampleOutput).toContain('<img src="svg/sprite.stack.svg#weather-clear"');
    expect(exampleOutput).toContain('<use href="svg/sprite.stack.svg#weather-clear"></use>');
    expect(exampleOutput).not.toContain('B) ');
    expect(exampleOutput).not.toContain('C) ');
  });

  it('should render the view preview without template leftovers', async () => {
    expect.hasAssertions();

    const exampleOutput = await renderExample('view', {});

    expect(exampleOutput).toMatch(/<img src="svg\/sprite\.view[^"]*#weather-clear"/u);
    expect(exampleOutput).not.toContain('{{');
    expect(exampleOutput).not.toContain('undefined');
  });
});
