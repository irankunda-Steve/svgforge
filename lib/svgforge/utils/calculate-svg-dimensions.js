import {createRequire} from 'node:module';
import DimensionsCalculationError from '../errors/dimensions-calculation-error.js';
import {getDependency} from '../../deps.js';

const requireResvg = createRequire(import.meta.url);

/**
 @typedef {object} Dimension
 @property {number} width Width in pixels
 @property {number} height Height in pixels
 */

let resvgModule;

/**
 Lazily load the optional `@resvg/resvg-js` package. Returns the package
 module, or `null` when the package is not installed. The result is cached so
 the package is resolved at most once per process.

 @returns {object|null} The package module or `null` if not installed
 */
const loadResvgModule = () => {
  if (resvgModule === undefined) {
    try {
      resvgModule = requireResvg('@resvg/resvg-js');
    } catch {
      resvgModule = null;
    }
  }

  return resvgModule;
};

/**
 Check whether the optional `@resvg/resvg-js` package is installed and can be
 used as the dimension calculation fallback

 @returns {boolean} `true` if the package is available
*/
export function isResvgAvailable() {
  return loadResvgModule() !== null;
}

/**
 Calculate an SVG's rendered dimensions. Requires the optionally installed
 `@resvg/resvg-js` package and throws a `DimensionsCalculationError` if it is
 not available.

 @param {string} svg SVG source string
 @returns {Dimension} dimension
 */
export default function calculateSvgDimensions(svg) {
  try {
    // Prefer an explicitly injected implementation (e.g. in tests) over the
    // lazily loaded optional `@resvg/resvg-js` package.
    const injectedModule = getDependency('@resvg/resvg-js', undefined);
    const resvgPackage = injectedModule ?? loadResvgModule();
    const Resvg = resvgPackage?.Resvg;

    if (!Resvg) {
      throw new Error('The optional "@resvg/resvg-js" package is not installed, so the dimension fallback is unavailable. '
        + 'Install it with `npm install @resvg/resvg-js` to enable dimension calculation '
        + 'for SVGs without width/height or viewBox attributes.');
    }

    const {width, height} = new Resvg(svg, {
      logLevel: 'error',
      font: {
        loadSystemFonts: false, // It will be faster to disable loading system fonts.
      },
    });

    return {width, height};
  } catch (error) {
    throw new DimensionsCalculationError(error.message, {cause: error});
  }
}
