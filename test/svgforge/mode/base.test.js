
/* eslint-disable new-cap -- tests instantiate mode classes */

import path from 'node:path';
import {Buffer} from 'node:buffer';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import File from 'vinyl';
import SVGSpriteBase from '../../../lib/svgforge/mode/base.js';
import {setDependency, resetDependencies} from '../../../lib/deps.js';
import {
  afterEach,
  createMock,
  describe,
  expect,
  it,
  restoreAllMocks,
} from '../../helpers/harness.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  restoreAllMocks();
  resetDependencies();
});

describe('testings SVGSpriteBase', () => {
  const TEST_MODE_NAME = 'base';
  const getClassAndInitFn = () => {
    const initFn = createMock();
    return {
      cls: class TestMode extends SVGSpriteBase {
        // Polymorphic hook (overridden or dispatched cross-class); `#private` would break dispatch.
        // eslint-disable-next-line unicorn/prefer-private-class-fields
        _init() {
          initFn();
        }

        get mode() {
          return TEST_MODE_NAME;
        }
      },
      initFn,
    };
  };

  describe('testing constructor', () => {
    it('should set default values', () => {
      expect.hasAssertions();

      const TEST_SPRITER = {
        config: {
          dest: '.',
          shape: {
            spacing: [],
          },
        },
        debug: createMock(),
      };
      const TEST_CONFIG = {
        dest: '.',
        prefix: '1',
        sprite: '',
      };
      const TEST_DATA = {};

      const {cls, initFn} = getClassAndInitFn();
      const base = new cls(TEST_SPRITER, TEST_CONFIG, TEST_DATA, '');

      expect(initFn).toHaveBeenCalledWith();

      expect(base._spriter).toBe(TEST_SPRITER);
      expect(base.config).toBe(TEST_CONFIG);
      expect(base.data).toBe(TEST_DATA);
      expect(base.data.mode).toBe(TEST_MODE_NAME);
      expect(base.data.key).toBe(TEST_MODE_NAME);

      expect(base.config.dest).toBe(path.resolve(TEST_SPRITER.config.dest, TEST_CONFIG.dest));
      expect(base.config.bust).toBe(false);
      expect(base.config.prefix).toBe('1%s');
      expect(base.config.sprite).toBe(path.resolve(TEST_CONFIG.dest, 'sprite.svg'));
      expect(base._cssDest).toBe(TEST_CONFIG.dest);
      expect(base.tmpl).toBe('common');
      expect(base.MODE_DEFS).toBe('defs');
      expect(base.MODE_SYMBOL).toBe('symbol');
      expect(base.MODE_STACK).toBe('stack');
      expect(base.MODE_VIEW).toBe('view');
    });

    describe('testing render', () => {
      it('should update config.render as expected', () => {
        expect.hasAssertions();

        const TEST_SPRITER = {
          config: {
            dest: '.',
            shape: {
              spacing: [],
            },
          },
          debug: createMock(),
        };
        const TEST_CONFIG = {
          dest: '.',
          prefix: '1',
          sprite: '',
          render: {
            svg: false,
            png: {},
            jpg: {
              template: 'jpg',
            },
            bmp: {
              dest: 'dest',
            },
            webp: {
              dest: 'here.webp',
            },
            css: {
              dest: 'css-dest/test',
            },
          },
        };
        const TEST_DATA = {};

        const {cls} = getClassAndInitFn();
        const base = new cls(TEST_SPRITER, TEST_CONFIG, TEST_DATA, '');

        expect(base.config.render).toStrictEqual(expect.objectContaining({
          png: {
            template: path.resolve(path.dirname(path.dirname(path.dirname(__dirname))), 'tmpl/common/sprite.png.vto'),
            dest: path.join(TEST_CONFIG.dest, 'sprite.png'),
          },
          jpg: {
            template: path.resolve(process.cwd(), 'jpg'),
            dest: path.join(TEST_CONFIG.dest, 'sprite.jpg'),
          },
          bmp: {
            dest: path.resolve(TEST_CONFIG.dest, 'dest.bmp'),
            template: path.resolve(path.dirname(path.dirname(path.dirname(__dirname))), 'tmpl/common/sprite.bmp.vto'),
          },
          webp: {
            dest: path.resolve(TEST_CONFIG.dest, 'here.webp'),
            template: path.resolve(path.dirname(path.dirname(path.dirname(__dirname))), 'tmpl/common/sprite.webp.vto'),
          },

        }));
        expect(base._cssDest).toBe(TEST_CONFIG.dest);
      });
    });
  });

  describe('testing _initData()', () => {
    it('should log', () => {
      expect.hasAssertions();

      const TEST_SPRITER = {
        config: {
          dest: '.',
          shape: {
            spacing: [],
          },
        },
        debug: createMock(),
      };
      const TEST_CONFIG = {
        dest: '.',
        prefix: '1',
        sprite: '',
      };
      const TEST_DATA = {};

      const {cls} = getClassAndInitFn();

      // eslint-disable-next-line no-new
      new cls(TEST_SPRITER, TEST_CONFIG, TEST_DATA, '');

      expect(TEST_SPRITER.debug).toHaveBeenCalledWith('Created «%s» sprite instance («%s» mode)', TEST_MODE_NAME, TEST_MODE_NAME);
    });

    describe('if example passed', () => {
      it('should create default config if truthy value passed', () => {
        expect.hasAssertions();

        const TEST_SPRITER = {
          config: {
            dest: '.',
            shape: {
              spacing: [],
            },
          },
          debug: createMock(),
        };
        const TEST_CONFIG = {
          dest: '.',
          prefix: '1',
          sprite: '',
          example: true,
        };
        const TEST_DATA = {};

        const {cls} = getClassAndInitFn();
        const base = new cls(TEST_SPRITER, TEST_CONFIG, TEST_DATA, '');

        expect(base.config.example).toStrictEqual({
          template: path.resolve(path.dirname(path.dirname(path.dirname(__dirname))), path.join('tmpl', TEST_MODE_NAME, 'sprite.vto')),
          dest: path.join(TEST_CONFIG.dest, `sprite.${TEST_MODE_NAME}.html`),
        });
        expect(base.data.example).toBe('sprite.svg');
      });

      it('should follow passed config', () => {
        expect.hasAssertions();

        const TEST_SPRITER = {
          config: {
            dest: '.',
            shape: {
              spacing: [],
            },
          },
          debug: createMock(),
        };
        const TEST_CONFIG = {
          dest: '.',
          prefix: '1',
          sprite: '',
          example: {
            template: 'test_template',
            dest: 'test_dest',
          },
        };
        const TEST_DATA = {};

        const {cls} = getClassAndInitFn();
        const base = new cls(TEST_SPRITER, TEST_CONFIG, TEST_DATA, '');

        expect(base.config.example).toStrictEqual({
          template: path.resolve(process.cwd(), TEST_CONFIG.example.template),
          dest: path.resolve(TEST_CONFIG.dest, TEST_CONFIG.example.dest),
        });

        expect(base.data.example).toBe('sprite.svg');
      });
    });
  });

  describe('testing _buildCSSResources', () => {
    it('should transform passed files', async () => {
      expect.hasAssertions();

      const TEST_SPRITER = {
        config: {
          dest: '.',
          shape: {
            spacing: [],
          },
        },
        _limit: 100,
        debug: createMock(),
        verbose: createMock(),
      };
      const TEST_CONFIG = {
        dest: '.',
        prefix: '1',
        sprite: '',
        render: {svg: true, png: true, bmp: false},
      };
      const {cls} = getClassAndInitFn();
      const base = new cls(TEST_SPRITER, TEST_CONFIG, {}, '');

      const TEST_FILES = {};
      const testFn = createMock();
      setDependency('template:render', createMock().mockResolvedValueOnce('first').mockResolvedValueOnce('second').mockResolvedValueOnce(''));

      base._buildCSSResources(TEST_FILES, testFn);

      await new Promise(setImmediate);

      expect(testFn).toHaveBeenCalledWith(null, [undefined, undefined]);
      expect(TEST_SPRITER.verbose).toHaveBeenCalledTimes(2);
      expect(TEST_SPRITER.verbose.mock.calls[0]).toEqual(['Created «%s» stylesheet resource', 'svg']);
      expect(TEST_SPRITER.verbose.mock.calls[1]).toEqual(['Created «%s» stylesheet resource', 'png']);
      expect(TEST_FILES).toStrictEqual({
        svg: new File({
          base: TEST_SPRITER.config.dest,
          path: path.join(TEST_CONFIG.dest, 'sprite.svg'),
          contents: Buffer.from('first'),
        }),
        png: new File({
          base: TEST_SPRITER.config.dest,
          path: path.join(TEST_CONFIG.dest, 'sprite.png'),
          contents: Buffer.from('second'),
        }),
      });
    });
  });

  describe('testing _buildHTMLExample()', () => {
    it('should add example in files', async () => {
      expect.hasAssertions();

      const TEST_SPRITER = {
        config: {
          dest: '.',
          shape: {
            spacing: [],
          },
        },
        _limit: 100,
        debug: createMock(),
        verbose: createMock(),
      };
      const TEST_CONFIG = {
        dest: '.',
        prefix: '1',
        sprite: '',
        example: {
          dest: '.',
        },
      };
      const {cls} = getClassAndInitFn();
      const base = new cls(TEST_SPRITER, TEST_CONFIG, {}, '');
      const testFn = createMock();
      const TEST_FILES = {};

      setDependency('template:render', createMock().mockResolvedValueOnce('test example'));
      base._buildHTMLExample(TEST_FILES, testFn);

      await new Promise(setImmediate);

      expect(testFn).toHaveBeenCalledWith(null, base.data);
      expect(TEST_FILES).toStrictEqual({
        example: new File({
          base: TEST_SPRITER.config.dest,
          path: TEST_CONFIG.example.dest,
          contents: Buffer.from('test example'),
        }),
      });
      expect(TEST_SPRITER.verbose).toHaveBeenCalledWith('Created «%s» HTML example file', TEST_MODE_NAME);
    });
  });

  describe('testing _addUnit()', () => {
    it('should add unit to number if number is not zero', () => {
      expect.hasAssertions();
      expect(SVGSpriteBase.prototype._addUnit(1, 'px')).toBe('1px');
    });

    it('should not add anything if number is zero', () => {
      expect.hasAssertions();
      expect(SVGSpriteBase.prototype._addUnit(0, 'px')).toBe('0');
    });
  });

  describe('testing declaration()', () => {
    it('should return local declaration if exists', () => {
      expect.hasAssertions();

      const TEST_DECLARATION = 'test declaration';

      expect(SVGSpriteBase.prototype.declaration(true, TEST_DECLARATION)).toBe(TEST_DECLARATION);
    });

    it('should return empty string if local declaration is falsy', () => {
      expect.hasAssertions();
      expect(SVGSpriteBase.prototype.declaration(true, false)).toBe('');
    });

    it('should return global if provided', () => {
      expect.hasAssertions();

      const TEST_DECLARATION = 'test declaration';

      expect(SVGSpriteBase.prototype.declaration(`${TEST_DECLARATION} `)).toBe(TEST_DECLARATION);
    });

    it('should return empty string if global declaration is not provided', () => {
      expect.hasAssertions();
      expect(SVGSpriteBase.prototype.declaration()).toBe('');
    });
  });

  describe('testing _addCacheBusting()', () => {
    it('should add busting', () => {
      expect.hasAssertions();

      const TEST_SPRITER = {
        config: {
          dest: '.',
          shape: {
            spacing: [],
          },
        },
        _limit: 100,
        debug: createMock(),
        verbose: createMock(),
      };
      const TEST_CONFIG = {
        dest: '.',
        bust: true,
        prefix: '1',
        sprite: '',
        example: {
          dest: '.',
        },
      };
      const {cls} = getClassAndInitFn();
      const base = new cls(TEST_SPRITER, TEST_CONFIG, {}, '');
      const TEST_SVG = 'svg';
      const TEST_SPRITE_MATCH = /sprite-[\da-z]{8}\.svg/u;

      expect(base._addCacheBusting(TEST_SVG)).toStrictEqual(expect.stringMatching(TEST_SPRITE_MATCH));
      expect(base.data.sprite).toStrictEqual(expect.stringMatching(TEST_SPRITE_MATCH));
      expect(base.data.example).toStrictEqual(expect.stringMatching(TEST_SPRITE_MATCH));
    });
  });
});
