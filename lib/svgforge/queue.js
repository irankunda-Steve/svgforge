import {EventEmitter} from 'node:events';
import path from 'node:path';
import {getDependency} from '../deps.js';
import {runWaterfall} from './utils/index.js';
import DimensionsCalculationError from './errors/dimensions-calculation-error.js';
import Shape from './shape/index.js';

/**
 Processing queue for shape files, feeding a spriter instance

 @param {SVGSpriter} spriter SVGSpriter instance
 */
// This queue exposes the EventEmitter API (`on`/`emit`) consumed by the spriter and the test helpers; EventTarget is not a drop-in.
// eslint-disable-next-line unicorn/prefer-event-target -- EventEmitter is a deliberate public API contract here.
export default class SVGSpriterQueue extends EventEmitter {
  constructor(spriter) {
    super();

    this._spriter = spriter;
    this._files = [];
    this.active = 0;

    this.on('add', this.process.bind(this));
    this.on('remove', this.process.bind(this));

    this._spriter.debug('Created processing queue instance');
  }

  /**
   Log a skipped shape, count it and announce it to the consumers

   Every skipped shape is announced through the `shape-skipped` event so that
   consumers (e.g. the CLI) can surface it regardless of the logger
   configuration. Missing/undeterminable dimensions are a warning: the build
   continues and the shape can still be rescued by installing the optional
   `@resvg/resvg-js` fallback. Any other processing error is a hard error.

   @param {string} name Shape name
   @param {Error} error Reason the shape was skipped
   */
  #reportSkip(name, error) {
    if (error instanceof DimensionsCalculationError) {
      this._spriter.warn('Skipping "%s" (%s)', name, error.message);
      this._spriter._dimensionSkipped = (this._spriter._dimensionSkipped ?? 0) + 1;
    } else {
      this._spriter.error('Skipping "%s" (%s)', name, error.message);
      this._spriter._errorSkipped = (this._spriter._errorSkipped ?? 0) + 1;
    }

    this.emit('shape-skipped', {file: name, error});
  }

  /**
   Signal that one shape left the queue

   `empty` means "all shapes are done" for the spriter and triggers the
   compilation, so it must only be emitted once no shape is being processed and
   no file is waiting anymore.
   */
  #emitQueueProgress() {
    --this.active;
    this.emit(this.active > 0 || this._files.length > 0 ? 'remove' : 'empty');
  }

  /**
   Add a shape to the processing queue

   @param {File} file Shape file
   */
  add(file) {
    this._spriter.debug('Added "%s" to processing queue', file.path.slice(file.base.length + path.sep.length));
    this._files.push(file);
    this.emit('add');
  }

  /**
   Try to process an item in the queue
   */
  process() {
    if (!(this._files.length > 0 && this.active < this._spriter._limit)) {
      return;
    }

    ++this.active;
    const file = this._files.shift();
    let shape;
    let spriter;

    // Instantiate the shape
    try {
      shape = getDependency('queue:Shape', Shape)(file, this._spriter);
      spriter = this._spriter;

      // In case of errors: Skip the file
    } catch (error) {
      this.#reportSkip(file.path.slice(file.base.length + path.sep.length), error);
      this.#emitQueueProgress();
      return;
    }

    // Subsequently run through all optimization and compilation tasks
    runWaterfall([
      // Transform the shape
      _cb => {
        spriter._transformShape(shape, _cb);
      },

      // Complement the shape
      _cb => {
        shape.complement(_cb);
      },
    ], error => this.remove(error, shape));
  }

  /**
   Remove a shape from the queue

   @param {Error} error Processing error, if any
   @param {SVGShape} shape Processed shape
   */
  remove(error, shape) {
    if (error) {
      this.#reportSkip(shape.id, error);
    } else {
      this._spriter._shapes.push(shape);
    }

    this.#emitQueueProgress();
  }
}
