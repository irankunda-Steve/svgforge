/**
 Svgforge is a Node.js module for creating SVG sprites

 @see https://github.com/svgforge/svgforge
 @author svgforge (https://github.com/SpotlightOn)
 @copyright © 2026 svgforge
 @license MIT https://github.com/svgforge/svgforge/blob/main/LICENSE
 */

import {Buffer} from 'node:buffer';
import path from 'node:path';
import events from 'node:events';
import {format} from 'node:util';
import File from 'vinyl';
import Config from './svgforge/config.js';
import Queue from './svgforge/queue.js';
import Layouter from './svgforge/layouter.js';
import svgo from './svgforge/transform/svgo.js';
import ArgumentError from './svgforge/errors/argument-error.js';
import {
  isFunction,
  isObject,
  isPlainObject,
  zipObject,
  deepMerge,
  runWaterfall,
  runParallelLimit,
} from './svgforge/utils/index.js';
import prettySize from './svgforge/utils/pretty-size.js';

// Maximum number of shapes to be processed in parallel (adjustable)
const MAX_PARALLEL_SHAPES = 4;

/**
 Creates an SVG sprite and manages its shapes, layouts and compilation

 @param {object} config Configuration
 */
class SVGSpriter extends events.EventEmitter {
  /**
   Create a new spriter instance

   @param {object} config Configuration
   */
  constructor(config) {
    super();

    this.config = new Config(config);
    this._queue = new Queue(this);
    this._shapes = [];
    this._namespacePow = [];
    this._shapeTransformers = {svgo};
    this._compileQueue = [];
    this._shapesDest = [];
    this._limit = MAX_PARALLEL_SHAPES;
    this._totalShapes = 0;
    this._processedShapes = 0;

    this.info('Processing up to %d shapes concurrently', this._limit);

    this._queue.on('remove', () => this.#emitProgress());
    this._queue.on('empty', () => this.#emitProgress());
    this._queue.on('shape-skipped', payload => this.emit('shape-skipped', payload));

    this._queue.on('empty', this._compile.bind(this));
    this._queue.on('empty', this._getShapes.bind(this));
    this.on('compiled', this._compile.bind(this));
    this.info('Created spriter instance');
  }

  /**
   Emit a progress event for each shape that finished processing
   */
  #emitProgress() {
    ++this._processedShapes;
    this.emit('progress', {
      processed: this._processedShapes,
      total: this._totalShapes,
    });
  }

  /**
   Add an SVG shape to the sprites

   @param {File | string} [file] Vinyl file object or absolute file path
   @param {string} [name] Name part of the file path
   @param {Buffer | string} [svg] SVG content
   @returns {SVGSpriter} Self reference
   @throws {Error}                           In case an invalid file is added
  */
  add(file = '', name = '', svg = '') {
    // If no vinyl file object has been given
    if (!this._isVinylFile(file)) {
      file = file.trim();
      file &&= path.normalize(file);

      let errorMessage = null;

      // If the name part of the file path is absolute
      if (name && path.isAbsolute(name)) {
        errorMessage = format('SVGSpriter.add: "%s" is not a valid relative file name', name);
      } else {
        name &&= name.trim();
        name &&= path.normalize(name);

        name ||= path.basename(file);
        // Performance note: SVG is converted Buffer -> String -> Buffer here; a future optimization could keep it in one form.
        if (Buffer.isBuffer(svg)) {
          svg = svg.toString();
        }

        svg = svg.trim();

        // Argument validation
        if (arguments.length < 3) {
          errorMessage = 'SVGSpriter.add: You must provide 3 arguments';
        } else if (file.length === 0) {
          errorMessage = format('SVGSpriter.add: "%s" is not a valid absolute file name', file);
        } else if (name.length === 0) {
          errorMessage = format('SVGSpriter.add: "%s" is not a valid relative file name', name);
        } else if (svg.length === 0) {
          errorMessage = 'SVGSpriter.add: You must provide SVG contents';
        } else if (!file.endsWith(name)) {
          errorMessage = format('SVGSpriter.add: "%s" is not the local part of "%s"', name, file);
        }
      }

      // In case of an error: Throw it!
      if (errorMessage) {
        const error = new ArgumentError(errorMessage);
        this.error(errorMessage, error);
        throw error;
      }

      // Resolve path before splitting it into base and path
      // so that Shape will properly extract a shape name later on.
      file = path.resolve(file);

      // Instantiate a vinyl file
      file = new File({
        base: file.slice(0, Math.max(0, file.length - name.length)),
        path: file,
        contents: Buffer.from(svg),
      });
    }

    file.base = path.resolve(file.base);
    file.path = path.resolve(file.path);

    // Add the shape to the internal processing queue
    ++this._totalShapes;
    this._queue.add(file);

    return this;
  }

  /**
   Duck-typing check for vinyl file objects

   This check is necessary as singletons don't work cross-module and `instanceof` fails in these situations.

   @param {unknown} file Arbitrary handled parameter
   @returns {boolean} Parameter is a vinyl file object
  */
  // Polymorphic hook (overridden or dispatched cross-class); `#private` would break dispatch.
  // eslint-disable-next-line unicorn/prefer-private-class-fields
  _isVinylFile(file) {
    return isObject(file) && (file instanceof File || (file.constructor.name === 'File' && ['path', 'contents', 'relative'].filter(property => Object.hasOwn(file, property)).length === 3));
  }

  /**
   Transform a single shape

   @param {SVGShape} shape Shape to be transformed
   @param {(error: Error | null) => void} cb Callback on completion
  */
  // Polymorphic hook (overridden or dispatched cross-class); `#private` would break dispatch.
  // eslint-disable-next-line unicorn/prefer-private-class-fields
  _transformShape(shape, cb) {
    const createTransformTask = transform => {
    // If it's a custom transformer
      if (isFunction(transform[1])) {
        return callback => {
          transform[1](shape, this, callback);
        };
      }

      // Else if it's a registered transformer
      if (Object.hasOwn(this._shapeTransformers, transform[0]) && isObject(transform[1])) {
        return callback => {
          this._shapeTransformers[transform[0]](shape, transform[1], this, callback);
        };
      }

      // Else: Break
      return null;
    };

    const tasks = [];

    // Run through all configured transforms
    for (const transform of this.config.shape.transform) {
      const task = createTransformTask(transform);

      if (task) {
        tasks.push(task);
      }
    }

    runWaterfall(tasks, error => {
      cb(error);
    });
  }

  /**
   Compile the sprite & additional resources

   @param {object} config Configuration
   @param {(error: Error | null, result: object, data: object) => void} cb Callback on completion
  */
  compile(config, cb) {
    const _config = isPlainObject(config)

      // eslint-disable-next-line unicorn/no-array-callback-reference -- Config#filter is a mode-option accessor, not Array#filter.
      ? this.config.filter(config)
      : deepMerge({}, this.config.mode);
    let _cb;

    if (isFunction(cb)) {
      _cb = cb;
    } else if (isFunction(config)) {
      _cb = config;
    } else {
      _cb = error => {
        throw error;
      };
    }

    // Schedule a compilation run
    this._compileQueue.push([_config, _cb]);
    this._compile();
  }

  /**
   Compile the sprite and return the result as a promise

   @param {object} config Configuration
   @returns {Promise<{result:{object}, data:{object}}>} Results
  */
  compileAsync(config) {
    return new Promise((resolve, reject) => {
      this.compile(config, (error, result, data) => {
        if (error) {
          return reject(error);
        }

        resolve({result, data});
      });
    });
  }

  /**
   Run the next compile task
  */
  // Polymorphic hook (overridden or dispatched cross-class); `#private` would break dispatch.
  // eslint-disable-next-line unicorn/prefer-private-class-fields
  _compile() {
  // If the shape queue is currently active return early
    if (this._queue.active || this._compileQueue.length === 0) {
      return;
    }

    const [config, cb] = this._compileQueue.shift();

    // If this is a modeless run
    if (Object.keys(config).length === 0) {
      const files = {};

      // Add intermediate SVG files
      if (this.config.shape.dest) {
        files.shapes = this._getShapeFiles(this.config.shape.dest);
        this.verbose('Returning %d intermediate SVG files', files.shapes.length);
      }

      this._logStats(files);
      cb(null, files, {});
    } else {
      this.info('Compiling %d shapes...', this._shapes.length);

      // Initialize the namespace powers
      while (this._namespacePow.length === 0 || (26 ** this._namespacePow.length < this._shapes.length)) {
        this._namespacePow.unshift(26 ** this._namespacePow.length);

        for (const shape of this._shapes) {
          shape.resetNamespace();
        }
      }

      // Sort shapes by ID
      this._shapes = this._shapes.toSorted(this.config.shape.sort);

      // Set the shape namespaces on all shapes
      for (const [index, shape] of this._shapes.entries()) {
        shape.setNamespace(this._indexNamespace(index));
      }

      this._layout(config, (error, files, data) => {
      // Add intermediate SVG files
        if (this.config.shape.dest) {
          files.shapes = this._getShapeFiles(this.config.shape.dest);
          this.verbose('Returning %d intermediate SVG files', files.shapes.length);
        }

        this.info('Finished %s sprite compilation', Object.keys(data).map(mode => `«${mode}»`).join(' + '));

        this._logStats(files);

        cb(error, files, data);
        this.emit('compiled');
      });
    }
  }

  /**
   Return a unique namespace prefix for a shape index

   @param {number} index Shape index
   @returns {string} Namespace prefix
  */
  // Polymorphic hook (overridden or dispatched cross-class); `#private` would break dispatch.
  // eslint-disable-next-line unicorn/prefer-private-class-fields
  _indexNamespace(index) {
    let namespace = '';

    for (const namespacePow of this._namespacePow) {
      const charCode = Math.floor(index / namespacePow);
      namespace += String.fromCodePoint(97 + charCode);
      index -= charCode * namespacePow;
    }

    return namespace;
  }

  /**
   Layout the sprites

   @param {object} config Layout configuration
   @param {(error: Error | null, result: object, data: object) => void} cb Callback on completion
  */
  // Polymorphic hook (overridden or dispatched cross-class); `#private` would break dispatch.
  // eslint-disable-next-line unicorn/prefer-private-class-fields
  _layout(config, cb) {
    const files = {};
    const layout = new Layouter(this, config);
    const createLayoutTask = (k, m) => _cb => {
      layout.layout(files, k, m, _cb);
    };

    const tasks = [];

    for (const [mode, value] of Object.entries(config)) {
      tasks.push(createLayoutTask(mode, value.mode));
    }

    runParallelLimit(tasks, this._limit, (error, data) => {
      if (error) {
        cb(error, files, {});
        return;
      }

      cb(error, files, zipObject(Object.values(data).map(value => value.key), data));
    });
  }

  /**
   Return all current shapes

   @param {string} dest Destination directory
   @param {(error: Error | null, result: Array) => void} cb Callback on completion
  */
  getShapes(dest, cb) {
    this._shapesDest.push([dest, cb]);
    this._getShapes();
  }

  /**
   Return all current shapes
  */
  // Polymorphic hook (overridden or dispatched cross-class); `#private` would break dispatch.
  // eslint-disable-next-line unicorn/prefer-private-class-fields
  _getShapes() {
  // If the shape queue is not currently active
    if (!this._queue.active) {
      while (this._shapesDest.length > 0) {
        const [dest, cb] = this._shapesDest.shift();
        cb(null, this._getShapeFiles(dest));
      }
    }
  }

  /**
   Return the shapes as a list of vinyl files

   @param {string} dest Destination directory
   @returns {Array} Shape file list
  */
  // Polymorphic hook (overridden or dispatched cross-class); `#private` would break dispatch.
  // eslint-disable-next-line unicorn/prefer-private-class-fields
  _getShapeFiles(dest) {
    return this._shapes.map(shape => new File({
      base: this.config.dest,
      path: path.join(dest, `${shape.id}.svg`),
      contents: Buffer.from(shape.getSVG(false)),
    }));
  }

  /**
   Log file statistics

   @param {object} files Mode-keyed resource groups to tally
  */
  // Polymorphic hook (overridden or dispatched cross-class); `#private` would break dispatch.
  // eslint-disable-next-line unicorn/prefer-private-class-fields
  _logStats(files) {
    const sizes = {};
    const extensions = {};

    for (const mode of Object.values(files)) {
      for (const resource of Object.values(mode)) {
        const file = resource.relative;
        const ext = path.extname(resource.path).toUpperCase();
        extensions[ext] = (extensions[ext] || 0) + 1;
        sizes[file] = prettySize(resource.contents.length);
      }
    }

    this.info('Created %s', Object.entries(extensions).map(ext => `${ext[1]} x ${ext[0].slice(1)}`).join(', '));

    const sortedSizes = Object.entries(sizes).toSorted(([a], [b]) => String(a) > String(b) ? 1 : -1);

    for (const [file, size] of sortedSizes) {
      this.verbose('Created %s: %s', file, size);
    }
  }

  /**
   Pass info messages on to the logger

   @param {...unknown} args arguments
  */
  info(...args) {
    this.config.log.info(...args);
  }

  /**
   Pass verbose messages on to the logger

   @param {...unknown} args arguments
  */
  verbose(...args) {
    this.config.log.verbose(...args);
  }

  /**
   Pass debug messages on to the logger

   @param {...unknown} args arguments
  */
  debug(...args) {
    this.config.log.debug(...args);
  }

  /**
   Pass warning messages on to the logger

   @param {...unknown} args arguments
  */
  warn(...args) {
    this.config.log.warn(...args);
  }

  /**
   Pass error messages on to the logger

   @param {...unknown} args arguments
  */
  error(...args) {
    this.config.log.error(...args);
  }
}

/**
 Module export (constructor wrapper)

 @param {object} config Configuration
 @returns {SVGSpriter} SVGSpriter instance
 */
export default function createSpriter(config = {}) {
  return new SVGSpriter(config);
}
