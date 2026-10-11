
import {Buffer} from 'node:buffer';
import File from 'vinyl';
import createShape from '../../../lib/svgforge/shape/index.js';
import {setDependency} from '../../../lib/deps.js';
import {
  describe,
  expect,
  it,
  createMock,
  afterEach,
} from '../../helpers/jest-compat.js';

const TEST_SPRITER = {
  config: {
    shape: {
      meta: {},
      align: {},
    },
  },
  verbose: createMock(),
};

const mockFixXMLString = createMock();
setDependency('fixXMLString', mockFixXMLString);

afterEach(() => {
  mockFixXMLString.mockReset();
});

describe('testing _initSVG()', () => {
  it('should call fixXMLString if passed svg is not normal', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('s'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    mockFixXMLString.mockReturnValueOnce('<svg></svg>');

    createShape(TEST_FILE, spriter);

    expect(mockFixXMLString).toHaveBeenCalledWith('s');
  });

  it('should call fixXMLString and throw error if passed svg is not normal', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('s'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    mockFixXMLString.mockReturnValueOnce('<');

    expect(() => {
      createShape(TEST_FILE, spriter);
    }).toThrow(new Error('Invalid SVG file'));

    expect(mockFixXMLString).toHaveBeenCalledWith('s');
  });

  it('should call fixXMLString and throw error if passed svg is not normal and fixXMLString thrown error', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('s'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    mockFixXMLString.mockImplementation(() => {
      throw new Error('error');
    });

    expect(() => {
      createShape(TEST_FILE, spriter);
    }).toThrow(new Error('Invalid SVG file (error)'));
    expect(mockFixXMLString).toHaveBeenCalledWith('s');
  });

  it('should not call fixXMLString if passed svg is normal', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('<svg></svg>'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    createShape(TEST_FILE, spriter);

    expect(mockFixXMLString).not.toHaveBeenCalled();
  });

  it('should fill entities', () => {
    expect.hasAssertions();

    const TEST_ENTITIES = [
      '<!ENTITY name1 "value1">',
      '<!ENTITY name2 "value2">',
    ];
    const TEST_FILE = new File({
      contents: Buffer.from(`<svg><!DOCTYPE ${TEST_ENTITIES.join('\n')}>&name1;</svg>`),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    const shape = createShape(TEST_FILE, spriter);

    expect(shape.svg.current.replace('\n', '')).toBe('<svg><!DOCTYPE <!ENTITY name1 "value1"><!ENTITY name2 "value2">>value1</svg>');
  });

  it('should throw error if bad svg parsed', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('<<ddfasdfasdf>>'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    expect(() => {
      createShape(TEST_FILE, spriter);
    }).toThrow('Invalid SVG file');
  });

  it('should set width and height', () => {
    expect.hasAssertions();

    const TEST_WIDTH = 200;
    const TEST_HEIGHT = 100;

    const TEST_FILE = new File({
      contents: Buffer.from(`<svg width="${TEST_WIDTH}" height="${TEST_HEIGHT}"></svg>`),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    const shape = createShape(TEST_FILE, spriter);

    expect(shape.width).toBe(TEST_WIDTH);
    expect(shape.height).toBe(TEST_HEIGHT);
  });

  it('should set width, height and viewBox to false', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('<svg></svg>'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    const shape = createShape(TEST_FILE, spriter);

    expect(shape.width).toBe(false);
    expect(shape.height).toBe(false);
    expect(shape.viewBox).toBe(false);
  });

  it('should set expected viewBox', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('<svg viewBox="0 1 2 3 4 5 20d ten"></svg>'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    const shape = createShape(TEST_FILE, spriter);

    expect(shape.viewBox).toStrictEqual([0, 1, 2, 3, 4, 5, 20, NaN]);
  });

  it('should fill viewBox', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('<svg viewBox="0 1"></svg>'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const spriter = {
      config: {
        shape: {
          meta: {},
          align: {},
        },
      },
      verbose: createMock(),
    };

    const shape = createShape(TEST_FILE, spriter);

    expect(shape.viewBox).toStrictEqual([0, 1, 0, 0]);
  });

  it('should set title and description to null', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('<svg></svg>'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });

    const shape = createShape(TEST_FILE, TEST_SPRITER);

    expect(shape.title).toBeNull();
    expect(shape.description).toBeNull();
  });

  it('should set title and description accordingly to svg', () => {
    expect.hasAssertions();

    const TEST_FILE = new File({
      contents: Buffer.from('<svg><title>test title</title><desc>test description</desc></svg>'),
      path: '/test_base/test_path',
      base: '/test_base/',
      cwd: '/',
    });
    const shape = createShape(TEST_FILE, TEST_SPRITER);

    expect(shape.title.toString()).toBe('<title xmlns="http://www.w3.org/2000/svg">test title</title>');
    expect(shape.description.toString()).toBe('<desc xmlns="http://www.w3.org/2000/svg">test description</desc>');
  });
});
