import {optimize as defaultOptimize} from 'svgo';
import prettySize from '../utils/pretty-size.js';
import {getDependency} from '../../deps.js';
import {deepMerge} from '../utils/index.js';
import {isSerializable, optimizeInWorker} from './svgo-pool.js';

/**
 SVGO transformation

 @param {SVGShape} shape SVG shape
 @param {object} config Transform configuration
 @param {SVGSpriter} spriter Spriter instance
 @param {(error: Error | null) => void} cb Callback on completion
 */
export default function optimizeWithSvgo(shape, config, spriter, cb) {
  // Svgo 4 no longer removes viewBox / <title> by default, but the sprite &
  // dimensions pipeline relies on them being stripped, so re-enable them
  // explicitly to preserve the previous output. The preset would also drop the
  // ARIA `role` attribute as an unknown attribute, so keep it explicitly —
  // the symbol mode whitelists `role` for accessible sprites.
  const defaultPluginsConfig = [{
    name: 'preset-default',
    params: {
      overrides: {
        removeUnknownsAndDefaults: {
          keepRoleAttr: true,
        },
      },
    },
  }, {
    name: 'removeViewBox',
  }, {
    name: 'removeTitle',
  }];

  config = deepMerge({}, config);
  config.plugins = 'plugins' in config ? config.plugins : defaultPluginsConfig;

  if (!spriter.config.svg.xmlDeclaration) {
    // Remove xml declaration if config.svg.xmlDeclaration is falsy
    config.plugins.push({
      name: 'removeXMLProcInst',
    });
  }

  if (!spriter.config.svg.doctypeDeclaration) {
    // Remove docType if config.svg.doctypeDeclaration is falsy
    config.plugins.push({
      name: 'removeDoctype',
    });
  }

  const svg = shape.getSVG(false);
  const svgLength = svg.length;

  const optimize = getDependency('svgo:optimize', defaultOptimize);
  const workerOptimize = getDependency('svgo:pool:optimize', optimizeInWorker);

  /**
   Apply an optimization result to the shape, log and finish.

   @param {{data: string}} result Optimization result
   */
  const finish = result => {
    shape.setSVG(result.data);
    let optSVGLength = null;

    for (const transport of spriter.config.log.transports) {
      if (transport.level !== 'debug') {
        continue;
      }

      optSVGLength ||= shape.getSVG(false).length;
      const size = svgLength - optSVGLength;
      const percentage = Math.round(100 * size / svgLength);
      spriter.debug('Optimized "%s" with SVGO (saved %s / %s%%)', shape.name, prettySize(size), percentage);
    }

    cb(null);
  };

  /**
   Report an optimization failure to the spriter and finish.

   @param {Error} error Optimization error
   */
  const fail = error => {
    spriter.error('Optimizing "%s" with SVGO failed with error "%s"', shape.name, error);
    cb(error);
  };

  // Offload the optimization to a worker thread whenever the real SVGO
  // optimizer runs with a config that survives structured cloning. Custom
  // configs containing functions or class instances (e.g. bespoke plugins)
  // cannot be transferred and fall back to in-process optimization.
  const useWorker = optimize === defaultOptimize && isSerializable(config);

  if (useWorker) {
    try {
      workerOptimize(svg, config).then(finish).catch(fail);
    } catch (error) {
      fail(error);
    }
  } else {
    try {
      finish(optimize(svg, config));
    } catch (error) {
      fail(error);
    }
  }
}
