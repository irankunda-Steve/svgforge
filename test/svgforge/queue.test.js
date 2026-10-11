
import {EventEmitter} from 'node:events';
import path from 'node:path';
import File from 'vinyl';
import SVGSpriterQueue from '../../lib/svgforge/queue.js';
import DimensionsCalculationError from '../../lib/svgforge/errors/dimensions-calculation-error.js';
import {setDependency} from '../../lib/deps.js';
import {
  beforeEach,
  describe,
  expect,
  it,
  createMock,
  spyOn,
} from '../helpers/jest-compat.js';

/* eslint-disable max-nested-callbacks -- Mock implementations of the queued shape/process callbacks are intentionally nested to model the async event flow under test. */

const mockShape = createMock();
setDependency('queue:Shape', mockShape);

describe('testing Queue', () => {
  describe('testing constructor()', () => {
    it('should be instance of EventEmitter', () => {
      expect.hasAssertions();

      const queue = new SVGSpriterQueue({debug: createMock()});

      expect(queue).toBeInstanceOf(EventEmitter);
    });

    it('should set initial values and debug to console', () => {
      expect.hasAssertions();

      const spriter = {debug: createMock()};
      const queue = new SVGSpriterQueue(spriter);

      expect(queue._spriter).toBe(spriter);
      expect(queue._files).toStrictEqual([]);
      expect(queue.active).toBe(0);
      expect(spriter.debug).toHaveBeenCalledWith('Created processing queue instance');
    });

    it('should add events', () => {
      expect.hasAssertions();

      const queue = new SVGSpriterQueue({debug: createMock()});

      expect(queue.listenerCount('add')).toBe(1);
      expect(queue.listenerCount('remove')).toBe(1);
    });
  });

  describe('testing add()', () => {
    it('should debug info, add file to _files and emit "add" event', () => {
      expect.hasAssertions();

      const spriter = {debug: createMock()};
      const TEST_FILE_NAME = '/base/test.svg';
      const TEST_FILE = new File({
        path: TEST_FILE_NAME,
        base: '/base/',
      });
      const queue = new SVGSpriterQueue(spriter);

      spyOn(queue, 'emit');

      queue.add(TEST_FILE);

      expect(spriter.debug).toHaveBeenLastCalledWith('Added "%s" to processing queue', path.basename(TEST_FILE_NAME));
      expect(queue._files).toStrictEqual([TEST_FILE]);
      expect(queue.emit).toHaveBeenCalledWith('add');
    });
  });

  describe('testing remove()', () => {
    let spriter;
    let queue;

    const TEST_SHAPE = {id: 'test-shape'};

    beforeEach(() => {
      spriter = {
        debug: createMock(),
        error: createMock(),
        warn: createMock(),
        _shapes: [],
      };
      queue = new SVGSpriterQueue(spriter);
    });

    it('should add shape to spriter', () => {
      expect.hasAssertions();

      queue.remove(null, TEST_SHAPE);

      expect(spriter._shapes).toStrictEqual([TEST_SHAPE]);
    });

    it('should not add shape to spriter, log the error and announce the skip if processing fails', () => {
      expect.hasAssertions();

      const TEST_ERROR = new Error('test');
      const onSkipped = createMock();
      queue.on('shape-skipped', onSkipped);
      queue.remove(TEST_ERROR, TEST_SHAPE);

      expect(spriter._shapes).toStrictEqual([]);
      expect(spriter.error).toHaveBeenCalledWith('Skipping "%s" (%s)', TEST_SHAPE.id, TEST_ERROR.message);
      expect(spriter._errorSkipped).toBe(1);
      expect(onSkipped).toHaveBeenCalledWith({file: TEST_SHAPE.id, error: TEST_ERROR});
    });

    it('should not add shape to spriter, log a warning with the install hint and count the skip if dimension calculation failed', () => {
      expect.hasAssertions();

      const TEST_ERROR = new DimensionsCalculationError('not installed — run `npm install @resvg/resvg-js`');
      const onSkipped = createMock();
      queue.on('shape-skipped', onSkipped);
      queue.remove(TEST_ERROR, TEST_SHAPE);

      expect(spriter._shapes).toStrictEqual([]);
      expect(spriter.warn).toHaveBeenCalledWith('Skipping "%s" (%s)', TEST_SHAPE.id, TEST_ERROR.message);
      expect(spriter._dimensionSkipped).toBe(1);
      expect(onSkipped).toHaveBeenCalledWith({file: TEST_SHAPE.id, error: TEST_ERROR});
    });

    it('should emit "remove" if active count is more than 1', () => {
      expect.hasAssertions();

      queue.active = 2;
      spyOn(queue, 'emit');
      queue.remove(null, TEST_SHAPE);

      expect(queue.emit).toHaveBeenCalledWith('remove');
    });

    it('should emit "empty" if active count is 1', () => {
      expect.hasAssertions();

      queue.active = 1;
      spyOn(queue, 'emit');
      queue.remove(null, TEST_SHAPE);

      expect(queue.emit).toHaveBeenCalledWith('empty');
    });
  });

  describe('testing process()', () => {
    let spriter;
    let queue;

    beforeEach(() => {
      spriter = {
        debug: createMock(),
        _limit: 10,
        error: createMock(),
        warn: createMock(),
        _transformShape: createMock().mockImplementation((shape, cb) => cb(null)),
      };
      queue = new SVGSpriterQueue(spriter);
    });

    it('should not do anything if files is empty', () => {
      expect.hasAssertions();

      queue._files = [];
      spyOn(queue._files, 'shift');
      queue.process();

      expect(queue._files.shift).not.toHaveBeenCalled();
    });

    it('should not do anything if active is exceeding limit', () => {
      expect.hasAssertions();

      queue._files = [1];
      queue.active = 11;
      spyOn(queue._files, 'shift');
      queue.process();

      expect(queue._files.shift).not.toHaveBeenCalled();
    });

    describe('testing positive case', () => {
      it('should increase active count call spriter._transformShape and shape.complement and then', async () => {
        expect.hasAssertions();

        const TEST_FILE = 'file';
        const TEST_SHAPE = {
          complement: createMock().mockImplementation(fn => {
            fn(TEST_SHAPE);
          }),
        };
        const testFn = createMock();
        queue._files = [1];
        queue.active = 2;
        spyOn(queue._files, 'shift').mockReturnValueOnce(TEST_FILE);
        mockShape.mockImplementation(() => TEST_SHAPE);

        spyOn(queue, 'remove').mockImplementation(() => {
          testFn();
        });

        queue.process();
        await new Promise(setImmediate); // Await all async code to finish (async.waterfall)

        expect(queue.active).toBe(3);
        expect(spriter._transformShape).toHaveBeenCalledWith(TEST_SHAPE, expect.any(Function));
        expect(TEST_SHAPE.complement).toHaveBeenCalledWith(expect.any(Function));
        expect(testFn).toHaveBeenCalledWith();
      });

      it('should not increase active call _spriter.error and emit "remove" event if error occured', async () => {
        expect.hasAssertions();

        const TEST_FILE = new File({path: '/base/file', base: '/base/'});
        const TEST_ERROR_MESSAGE = 'error';
        queue._files = [1];
        queue.active = 2;
        spyOn(queue._files, 'shift').mockReturnValueOnce(TEST_FILE);
        queue.emit = createMock();
        mockShape.mockImplementation(() => {
          throw new Error(TEST_ERROR_MESSAGE);
        });

        queue.process();
        await new Promise(setImmediate); // Await all async code to finish (async.waterfall)

        expect(queue.active).toBe(2);
        expect(spriter.error).toHaveBeenCalledWith('Skipping "%s" (%s)', 'file', TEST_ERROR_MESSAGE);
        expect(spriter._errorSkipped).toBe(1);
        expect(queue.emit).toHaveBeenCalledWith('shape-skipped', {file: 'file', error: expect.any(Error)});
        expect(queue.emit).toHaveBeenCalledWith('remove');
      });

      it('should not increase active call _spriter.error and emit "remove" event if error occured and active is zero', async () => {
        expect.hasAssertions();

        const TEST_FILE = new File({path: '/base/file', base: '/base/'});
        queue._files = [1];
        queue.active = 0;
        spyOn(queue._files, 'shift').mockReturnValueOnce(TEST_FILE);
        spyOn(queue, 'emit');
        mockShape.mockImplementation(() => {
          throw new Error('test');
        });

        queue.process();
        await new Promise(setImmediate); // Await all async code to finish (async.waterfall)

        expect(queue.active).toBe(0);
        expect(queue.emit).toHaveBeenCalledWith('empty');
      });
    });
  });
});

/* eslint-enable max-nested-callbacks */
