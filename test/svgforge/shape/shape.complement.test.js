
import {Buffer} from 'node:buffer';
import File from 'vinyl';
import createShape from '../../../lib/svgforge/shape/index.js';
import DimensionsCalculationError from '../../../lib/svgforge/errors/dimensions-calculation-error.js';
import {setDependency, resetDependencies} from '../../../lib/deps.js';
import {
  afterEach,
  beforeEach,
  createMock,
  describe,
  expect,
  it,
  restoreAllMocks,
  spyOn,
} from '../../helpers/harness.js';

const TEST_SPRITER = {
  config: {
    shape: {
      meta: {},
      align: {},
    },
    svg: {
      doctypeDeclaration: '',
    },
  },
  verbose: createMock(),
};
const TEST_FILE = new File({
  contents: Buffer.from('<svg></svg>'),
  path: '/test_base/test_path',
  base: '/test_base/',
  cwd: '/',
});

let mockCalc;

beforeEach(() => {
  mockCalc = createMock();
  setDependency('calculate-svg-dimensions', mockCalc);
});

afterEach(() => {
  restoreAllMocks();
  resetDependencies();
});

describe('testing _complementDimensions()', () => {
  it('should call _setDimensions if shape has width and height', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const cb = createMock();

    shape.width = 10;
    shape.height = 10;
    spyOn(shape, '_setDimensions');

    shape._complementDimensions(cb);

    expect(shape._setDimensions).toHaveBeenCalledWith(cb);
  });

  it('should call _determineDimensions and then _setDimensions if shape has no width and height', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const cb = createMock();

    shape.width = 0;
    shape.height = 0;
    spyOn(shape, '_determineDimensions').mockImplementation(dimensionCb => dimensionCb(null));
    spyOn(shape, '_setDimensions');

    shape._complementDimensions(cb);

    expect(shape._determineDimensions).toHaveBeenCalledTimes(1);
    expect(shape._setDimensions).toHaveBeenCalledWith(cb);
  });

  it('should call the callback with an error and skip _setDimensions if dimension determination fails', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const cb = createMock();
    const TEST_ERROR = new Error('dimension calculation failed');

    shape.width = 0;
    shape.height = 0;
    spyOn(shape, '_determineDimensions').mockImplementation(dimensionCb => dimensionCb(TEST_ERROR));
    spyOn(shape, '_setDimensions');

    shape._complementDimensions(cb);

    expect(shape._determineDimensions).toHaveBeenCalledTimes(1);
    expect(shape._setDimensions).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith(TEST_ERROR);
  });
});

describe('testing _determineDimensions()', () => {
  it('should set viewBox', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const cb = createMock();
    spyOn(shape, '_round').mockReturnValueOnce(10).mockReturnValueOnce(20);
    shape.viewBox = [0, 1, 2, 3];
    shape.width = 1;
    shape.height = 1;

    shape._determineDimensions(cb);

    expect(cb).toHaveBeenCalledWith(null);
    expect(shape._round).toHaveBeenCalledTimes(2);
    expect(shape._round.mock.calls[0][0]).toBe(2);
    expect(shape._round.mock.calls[1][0]).toBe(3);
    expect(shape.width).toBe(10);
    expect(shape.height).toBe(20);
  });

  it('should call calculateSvgDimensions', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const TEST_WIDTH = 200;
    const TEST_HEIGHT = 100;
    const TEST_SVG = 'svg';

    const cb = createMock();
    spyOn(shape, '_round').mockReturnValueOnce(10).mockReturnValueOnce(20);
    spyOn(shape, 'getSVG').mockReturnValueOnce(TEST_SVG);
    shape.width = 0;
    shape.height = 0;

    mockCalc.mockReturnValueOnce({width: TEST_WIDTH, height: TEST_HEIGHT});
    shape._determineDimensions(cb);

    expect(cb).toHaveBeenCalledWith(null);
    expect(mockCalc).toHaveBeenCalledWith(TEST_SVG);
    expect(shape._round).toHaveBeenCalledTimes(2);
    expect(shape._round.mock.calls[0][0]).toBe(TEST_HEIGHT);
    expect(shape._round.mock.calls[1][0]).toBe(TEST_WIDTH);
  });

  it('should call callback with error raised in calculateSvgDimensions', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const cb = createMock();
    const TEST_ERROR = 'test error';
    shape.width = 0;
    shape.height = 0;

    mockCalc.mockImplementation(() => {
      throw new DimensionsCalculationError(TEST_ERROR);
    });
    shape._determineDimensions(cb);

    expect(cb).toHaveBeenCalledWith(new DimensionsCalculationError(TEST_ERROR));
  });
});

describe('testing _setDimensions()', () => {
  it('should set viewbox and call cb', () => {
    expect.hasAssertions();

    const TEST_WIDTH = 300;
    const TEST_HEIGHT = 100;
    const shape = createShape(TEST_FILE, TEST_SPRITER);
    shape.width = TEST_WIDTH;
    shape.height = TEST_HEIGHT;

    const cb = createMock();
    spyOn(shape, 'getViewbox').mockReturnValueOnce(null);
    shape._setDimensions(cb);

    expect(shape.getViewbox).toHaveBeenCalledWith(TEST_WIDTH, TEST_HEIGHT);
    expect(cb).toHaveBeenCalledWith(null);
  });

  it('should set attributes for all dimensions', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const TEST_WIDTH = 300;
    const TEST_HEIGHT = 100;
    spyOn(shape.dom.documentElement, 'setAttribute').mockImplementation();
    spyOn(shape, 'getViewbox').mockReturnValueOnce(null);
    spyOn(shape, 'getDimensions').mockReturnValueOnce({height: TEST_HEIGHT, width: TEST_WIDTH});
    shape._setDimensions(createMock());

    expect(shape.dom.documentElement.setAttribute).toHaveBeenCalledTimes(2);
    expect(shape.dom.documentElement.setAttribute.mock.calls[0]).toStrictEqual(expect.arrayContaining(['height', TEST_HEIGHT]));
    expect(shape.dom.documentElement.setAttribute.mock.calls[1]).toStrictEqual(expect.arrayContaining(['width', TEST_WIDTH]));
  });

  describe('shape need to be scaled', () => {
    it('should scale if width is more than maxWidth', () => {
      expect.hasAssertions();

      const TEST_WIDTH = 400;
      const TEST_HEIGHT = 100;
      const shape = createShape(TEST_FILE, TEST_SPRITER);
      shape.width = TEST_WIDTH;
      shape.height = TEST_HEIGHT;
      shape.config.spacing.box = 'padding';
      shape.config.spacing.padding.right = 10;
      shape.config.spacing.padding.left = 10;
      shape.config.dimension.maxWidth = TEST_WIDTH;

      shape._setDimensions(createMock());

      expect(shape._scale).toBe(380 / 400);
      expect(shape.width).toBe(380);
      expect(shape.height).toBe(100 * 380 / 400);
    });

    it('should scale if height is more than maxHeight', () => {
      expect.hasAssertions();

      const TEST_WIDTH = 300;
      const TEST_HEIGHT = 100;
      const shape = createShape(TEST_FILE, TEST_SPRITER);
      shape.width = TEST_WIDTH;
      shape.height = TEST_HEIGHT;
      shape.config.spacing.box = 'padding';
      shape.config.spacing.padding.top = 10;
      shape.config.spacing.padding.bottom = 10;
      shape.config.dimension.maxHeight = TEST_HEIGHT;

      shape._setDimensions(createMock());

      expect(shape.height).toBe(80);
      expect(shape.width).toBe(300 * 80 / 100);
      expect(shape._scale).toBe(0.8);
    });

    it('should scale if height is less than maxHeight and width is less than maxWidth nad spacing is icon', () => {
      expect.hasAssertions();

      const TEST_WIDTH = 300;
      const TEST_HEIGHT = 100;
      const shape = createShape(TEST_FILE, TEST_SPRITER);
      shape.width = TEST_WIDTH / 2;
      shape.height = TEST_HEIGHT / 2;
      shape.config.spacing.box = 'icon';
      shape.config.dimension.maxHeight = TEST_HEIGHT;
      shape.config.dimension.maxWidth = TEST_WIDTH;

      shape._setDimensions(createMock());

      expect(shape._scale).toBe(2);
      expect(shape.height).toBe(100);
      expect(shape.width).toBe(150 * 2);
    });
  });

  describe('with icon box size', () => {
    it('should set expected spacing', () => {
      expect.hasAssertions();

      const TEST_WIDTH = 300;
      const TEST_HEIGHT = 100;
      const shape = createShape(TEST_FILE, TEST_SPRITER);
      shape.width = TEST_WIDTH * 2;
      shape.height = TEST_HEIGHT;
      shape.config.spacing.box = 'icon';
      shape.config.dimension.maxHeight = TEST_HEIGHT;
      shape.config.dimension.maxWidth = TEST_WIDTH;

      shape._setDimensions(createMock());

      expect(shape.config.spacing.padding.left).toBe(0);
      expect(shape.config.spacing.padding.right).toBe(0);
      expect(shape.config.spacing.padding.top).toBe(25);
      expect(shape.config.spacing.padding.bottom).toBe(25);
    });
  });
});

describe('testing _addPadding()', () => {
  it('should set viewbox from getViewbox() and add padding from config.spacing.padding', () => {
    expect.hasAssertions();

    const noop = createMock();
    const shape = createShape(TEST_FILE, TEST_SPRITER);

    spyOn(shape, 'getViewbox').mockReturnValueOnce([100, 200, 300, 400]);
    spyOn(shape, 'setViewbox');
    spyOn(shape, 'setDimensions');

    shape.config.spacing.padding = {
      top: 10,
      right: 20,
      bottom: 30,
      left: 40,
    };
    shape._scale = 2;

    shape._addPadding(noop);

    expect(noop).toHaveBeenCalledWith(null);
    expect(shape.setViewbox).toHaveBeenCalledWith([80, 195, 330, 420]);
    expect(shape.setDimensions).toHaveBeenCalledWith(60, 40);
  });

  it('should set viewbox if config.spacing.padding is zero', () => {
    expect.hasAssertions();

    const noop = createMock();
    const shape = createShape(TEST_FILE, TEST_SPRITER);

    spyOn(shape, 'getViewbox');
    spyOn(shape, 'setViewbox');
    spyOn(shape, 'setDimensions');

    shape.config.spacing.padding = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };

    shape._addPadding(noop);

    expect(noop).toHaveBeenCalledWith(null);
    expect(shape.setViewbox).not.toHaveBeenCalled();
    expect(shape.setDimensions).not.toHaveBeenCalled();
  });
});

describe('testing _addMetadata()', () => {
  it('should set meta description', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const noop = createMock();
    const TEST_DESCRIPTION = 'TEST';

    shape.meta.description = TEST_DESCRIPTION;
    shape.id = 'TEST_ID';
    shape.description = {setAttribute: createMock()};
    spyOn(shape.dom.documentElement, 'setAttribute').mockImplementation();

    shape._addMetadata(noop);

    expect(noop).toHaveBeenCalledWith(null);
    expect(shape.description.textContent).toBe(TEST_DESCRIPTION);
    expect(shape.description.setAttribute).toHaveBeenCalledWith('id', `${shape.id}-desc`);
    expect(shape.dom.documentElement.setAttribute).toHaveBeenCalledWith('aria-labelledby', `${shape.id}-desc`);
  });

  it('should set description if not exists', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const noop = createMock();
    const TEST_DESCRIPTION = 'TEST';

    shape.description = null;
    shape.meta.description = TEST_DESCRIPTION;

    shape._addMetadata(noop);

    expect(shape.description).not.toBeNull();
    expect(shape.description.toString()).toBe('<desc id="test_path-desc" xmlns="http://www.w3.org/2000/svg">TEST</desc>');
  });

  it('should set meta title', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const noop = createMock();
    const TEST_TITLE = 'TEST';

    shape.meta.title = TEST_TITLE;
    shape.id = 'TEST_ID';
    shape.title = {setAttribute: createMock()};
    spyOn(shape.dom.documentElement, 'setAttribute').mockImplementation();

    shape._addMetadata(noop);

    expect(noop).toHaveBeenCalledWith(null);
    expect(shape.title.textContent).toBe(TEST_TITLE);
    expect(shape.title.setAttribute).toHaveBeenCalledWith('id', `${shape.id}-title`);
    expect(shape.dom.documentElement.setAttribute).toHaveBeenCalledWith('aria-labelledby', `${shape.id}-title`);
  });

  it('should set title if not exists', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const noop = createMock();
    const TEST_TITLE = 'TEST';

    shape.title = null;
    shape.meta.title = TEST_TITLE;

    shape._addMetadata(noop);

    expect(shape.title).not.toBeNull();
    expect(shape.title.toString()).toBe('<title id="test_path-title" xmlns="http://www.w3.org/2000/svg">TEST</title>');
  });

  it('should remove aria-labelledby if neither title or descriptions contains in meta', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    const noop = createMock();

    spyOn(shape.dom.documentElement, 'hasAttribute').mockReturnValueOnce(true);
    spyOn(shape.dom.documentElement, 'removeAttribute');

    shape._addMetadata(noop);

    expect(shape.dom.documentElement.hasAttribute).toHaveBeenCalledWith('aria-labelledby');
    expect(shape.dom.documentElement.removeAttribute).toHaveBeenCalledWith('aria-labelledby');
  });
});

describe('testing complement()', () => {
  it('should call all functions and set ready state', async () => {
    expect.hasAssertions();

    const testComplementDimensions = createMock().mockImplementation(fn => fn(null));
    const testAddPadding = createMock().mockImplementation(fn => fn(null));
    const testAddMetadata = createMock().mockImplementation(fn => fn(null));
    const noop = createMock();

    const shape = createShape(TEST_FILE, TEST_SPRITER);

    shape._complementDimensions = {
      bind() {
        return testComplementDimensions;
      },
    };
    shape._addPadding = {
      bind() {
        return testAddPadding;
      },
    };
    shape._addMetadata = {
      bind() {
        return testAddMetadata;
      },
    };

    shape.complement(noop);

    await new Promise(setImmediate);

    expect(testComplementDimensions).toHaveBeenCalledTimes(1);
    expect(testAddPadding).toHaveBeenCalledTimes(1);
    expect(testAddMetadata).toHaveBeenCalledTimes(1);

    expect(shape.svg.ready.toString()).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
    expect(noop).toHaveBeenCalledWith(null, shape);
  });
});
