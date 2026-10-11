
import svgoTransform from '../../../lib/svgforge/transform/svgo.js';
import {setDependency, resetDependencies} from '../../../lib/deps.js';
import {
  afterEach,
  beforeEach,
  createMock,
  describe,
  expect,
  it,
  restoreAllMocks,
} from '../../helpers/harness.js';

const TEST_SVG = '<svg></svg>';

describe('testing transforms.svgo', () => {
  let noop;
  let mockOptimize;

  beforeEach(() => {
    noop = createMock();
    mockOptimize = createMock().mockReturnValue({data: ''});
    setDependency('svgo:optimize', mockOptimize);
  });

  afterEach(() => {
    restoreAllMocks();
    resetDependencies();
  });

  it('should set default config with expected params if not provided 1', () => {
    expect.hasAssertions();

    const spriter = {
      config: {
        svg: {
          xmlDeclaration: false,
          doctypeDeclaration: false,
        },
      },
      error: createMock(),
    };
    const shape = {
      setSVG: createMock(),
      getSVG: createMock().mockReturnValue(TEST_SVG),
    };
    const TEST_RESULT = 'test result';

    mockOptimize.mockReturnValueOnce(TEST_RESULT);
    svgoTransform(shape, {}, spriter, noop);

    expect(mockOptimize).toHaveBeenCalledWith(TEST_SVG, {
      plugins: [{
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
      }, {
        name: 'removeXMLProcInst',
      }, {
        name: 'removeDoctype',
      }],
    });
  });

  it('should set default config with expected params if not provided 2', () => {
    expect.hasAssertions();

    const spriter = {
      config: {
        svg: {
          xmlDeclaration: true,
          doctypeDeclaration: true,
        },
      },
      error: createMock(),
    };
    const shape = {
      setSVG: createMock(),
      getSVG: createMock().mockReturnValue(TEST_SVG),
    };
    const TEST_RESULT = 'test result';

    mockOptimize.mockReturnValueOnce(TEST_RESULT);
    svgoTransform(shape, {}, spriter, noop);

    expect(mockOptimize).toHaveBeenCalledWith(TEST_SVG, {
      plugins: [{
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
      }],
    });
  });

  it('should add provided config', () => {
    expect.hasAssertions();

    const TEST_PLUGINS = [{
      name: 'preset-default',
      params: {
        overrides: {
          removeTitle: false,
          removeDesc: false,
        },
      },
    }];
    const spriter = {
      config: {
        svg: {
          xmlDeclaration: true,
          doctypeDeclaration: true,
        },
      },
      error: createMock(),
    };
    const shape = {
      setSVG: createMock(),
      getSVG: createMock().mockReturnValue(TEST_SVG),
    };
    const TEST_RESULT = 'test result';

    mockOptimize.mockReturnValueOnce(TEST_RESULT);
    svgoTransform(shape, {plugins: TEST_PLUGINS}, spriter, noop);

    expect(mockOptimize).toHaveBeenCalledWith(TEST_SVG, {plugins: expect.arrayContaining(TEST_PLUGINS)});
  });

  it('should log about optimizations', () => {
    expect.hasAssertions();

    const MOCKED_ORIGINAL_SVG = 'svgsvg';
    const MOCKED_OPTIMIZED_SVG = 'svg';
    const spriter = {
      config: {
        svg: {},
        log: {
          transports: [{
            level: 'debug',
          }, {
            level: 'debug',
          }],
        },
      },
      error: createMock(),
      debug: createMock(),
    };
    const shape = {
      name: 'name',
      setSVG: createMock(),
      getSVG: createMock().mockReturnValueOnce(MOCKED_ORIGINAL_SVG).mockReturnValueOnce(MOCKED_OPTIMIZED_SVG),
    };

    mockOptimize.mockReturnValueOnce({});
    svgoTransform(shape, {}, spriter, noop);

    expect(spriter.debug).toHaveBeenCalledTimes(2);
    expect(spriter.debug).toHaveBeenCalledWith('Optimized "%s" with SVGO (saved %s / %s%%)', 'name', '3 Bytes', 50);
  });

  it('should not log about optimizations', () => {
    expect.hasAssertions();

    const spriter = {
      config: {
        svg: {},
        log: {
          transports: [{
            level: 'info',
          }],
        },
      },
      error: createMock(),
      debug: createMock(),
    };
    const shape = {
      name: 'name',
      setSVG: createMock(),
      getSVG: createMock().mockReturnValue(TEST_SVG),
    };

    mockOptimize.mockReturnValueOnce({});
    svgoTransform(shape, {}, spriter, noop);

    expect(spriter.debug).not.toHaveBeenCalled();
  });

  it('should call callback', () => {
    expect.hasAssertions();

    const spriter = {
      config: {
        svg: {},
        log: {
          transports: [],
        },
      },
      error: createMock(),
      debug: createMock(),
    };
    const shape = {
      name: 'name',
      setSVG: createMock(),
      getSVG: createMock().mockReturnValue(TEST_SVG),
    };

    mockOptimize.mockReturnValueOnce({});
    svgoTransform(shape, {}, spriter, noop);

    expect(noop).toHaveBeenCalledWith(null);
  });

  it('should call callback with error and call spriter.error if error raised', () => {
    expect.hasAssertions();

    const TEST_ERROR = new Error('test');

    const spriter = {
      config: {
        svg: {},
      },
      error: createMock(),
      debug: createMock(),
    };
    const shape = {
      name: 'name',
      setSVG: createMock(),
      getSVG: createMock().mockReturnValue(TEST_SVG),
    };

    mockOptimize.mockImplementationOnce(() => {
      throw TEST_ERROR;
    });
    svgoTransform(shape, {}, spriter, noop);

    expect(noop).toHaveBeenCalledWith(TEST_ERROR);
    expect(spriter.error).toHaveBeenCalledWith('Optimizing "%s" with SVGO failed with error "%s"', 'name', TEST_ERROR);
  });
});
