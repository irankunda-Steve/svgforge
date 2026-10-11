import {Buffer} from 'node:buffer';
import {DOMParser} from '@xmldom/xmldom';
import File from 'vinyl';
import createShape from '../../../lib/svgforge/shape/index.js';
import NotPermittedError from '../../../lib/svgforge/errors/not-permitted-error.js';
import {setDependency} from '../../../lib/deps.js';
import {
  createMock,
  describe,
  expect,
  it,
  spyOn,
} from '../../helpers/harness.js';

const mockMinifyBlock = createMock().mockReturnValue({css: ''});
setDependency('csso', {minifyBlock: mockMinifyBlock});

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

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';

const parse = svg => new DOMParser().parseFromString(svg, 'image/svg+xml');

describe('testing setNamespace()', () => {
  /**
   Creates a configured SVGShape for namespace testing.
   @param {boolean} addNamespaceIds shape.spriter.config.svg.namespaceIDs
   @param {boolean} isNamespaced shape._namespaced
   @param {boolean} addNamespaceClassnames shape.spriter.config.svg.namespaceClassnames
   @returns {object} SVGShape
   */
  const makeShape = (addNamespaceIds, isNamespaced, addNamespaceClassnames) => {
    const shape = createShape(TEST_FILE, TEST_SPRITER);

    shape.spriter.config.svg.namespaceIDs = addNamespaceIds;
    shape.spriter.config.svg.namespaceClassnames = addNamespaceClassnames;
    shape._namespaced = isNamespaced;
    shape.svg.ready = '<svg/>';
    return shape;
  };

  it('should raise error if shape is not ready', () => {
    expect.hasAssertions();

    const shape = makeShape(true, false, true);
    shape.svg.ready = false;

    expect(() => {
      shape.setNamespace({});
    }).toThrow(new NotPermittedError('Shape namespace cannot be set before complementing'));
  });

  describe('if namespaceIds', () => {
    it('should namespace all IDs and substitute ID references', () => {
      expect.hasAssertions();

      const shape = makeShape(true, false, false);
      spyOn(shape, '_replaceIdAndClassnameReferences').mockImplementation(value => value);
      const TEST_NAMESPACE = 'test-namespace';
      shape.dom = parse(`<svg xmlns="${SVG_NAMESPACE}" xmlns:xlink="${XLINK_NAMESPACE}" aria-labelledby="a test">
        <g id="a"><use href="#a"/><use href="data:keep"/><path fill="#a"/><use xlink:href="#a"/><use xlink:href="data:also-keep"/></g>
        <style>x{}</style>
      </svg>`);

      shape.setNamespace(TEST_NAMESPACE);

      // eslint-disable-next-line unicorn/prefer-query-selector -- `@xmldom/xmldom` provides no `querySelector` API.
      const g = shape.dom.getElementsByTagName('g')[0];
      // eslint-disable-next-line unicorn/prefer-query-selector -- `@xmldom/xmldom` provides no `querySelectorAll` API.
      const uses = shape.dom.getElementsByTagName('use');
      // eslint-disable-next-line unicorn/prefer-query-selector -- `@xmldom/xmldom` provides no `querySelector` API.
      const path = shape.dom.getElementsByTagName('path')[0];

      expect(g.getAttribute('id')).toBe(`${TEST_NAMESPACE}a`);
      expect(uses[0].getAttribute('href')).toBe(`#${TEST_NAMESPACE}a`);
      expect(uses[1].getAttribute('href')).toBe('data:keep');
      expect(path.getAttribute('fill')).toBe('#a');
      expect(uses[2].getAttribute('href')).toBe(`#${TEST_NAMESPACE}a`);
      expect(uses[2].getAttributeNS(XLINK_NAMESPACE, 'href')).toBeNull();
      expect(uses[3].getAttribute('href')).toBeNull();
      expect(uses[3].getAttributeNS(XLINK_NAMESPACE, 'href')).toBe('data:also-keep');
      expect(shape.dom.documentElement.getAttribute('aria-labelledby')).toBe(`${TEST_NAMESPACE}a test`);
      expect(shape._namespaced).toBe(true);

      expect(mockMinifyBlock).toHaveBeenCalledWith('x{}', {restructure: false});
    });
  });

  describe('with namespaceClassnames', () => {
    it('should namespace all class names', () => {
      expect.hasAssertions();

      const shape = makeShape(false, false, true);
      spyOn(shape, '_replaceIdAndClassnameReferences').mockImplementation();
      const TEST_NAMESPACE = 'ns';
      shape.dom = parse(`<svg xmlns="${SVG_NAMESPACE}"><g class="1 2 3 4 5  6 "/></svg>`);

      shape.setNamespace(TEST_NAMESPACE);

      // eslint-disable-next-line unicorn/prefer-query-selector -- `@xmldom/xmldom` provides no `querySelector` API.
      const g = shape.dom.getElementsByTagName('g')[0];
      expect(g.getAttribute('class')).toBe(`${TEST_NAMESPACE}1 ${TEST_NAMESPACE}2 ${TEST_NAMESPACE}3 ${TEST_NAMESPACE}4 ${TEST_NAMESPACE}5 ${TEST_NAMESPACE}6`);
      expect(shape._namespaced).toBe(true);
    });
  });

  it('should return early if already namespaced', () => {
    expect.hasAssertions();

    const shape = makeShape(true, true, true);

    shape.setNamespace('123');

    expect(shape._namespaced).toBe(true);
  });

  it('should convert xlink:href attributes even without namespaceIds and namespaceClassnames', () => {
    expect.hasAssertions();

    const shape = makeShape(false, false, false);
    shape.dom = parse(`<svg xmlns="${SVG_NAMESPACE}" xmlns:xlink="${XLINK_NAMESPACE}"><use xlink:href="#id"/></svg>`);

    shape.setNamespace('123');

    // eslint-disable-next-line unicorn/prefer-query-selector -- `@xmldom/xmldom` provides no `querySelector` API.
    const use = shape.dom.getElementsByTagName('use')[0];
    expect(use.getAttribute('href')).toBe('#id');
    expect(use.getAttributeNS(XLINK_NAMESPACE, 'href')).toBeNull();
    expect(shape._namespaced).toBe(true);
  });
});

describe('testing resetNamespace()', () => {
  it('should not change _namespaced if it is already not namespaced', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    shape._namespaced = false;
    shape.resetNamespace();

    expect(shape._namespaced).toBe(false);
  });

  it('should not change _namespaced if this.spriter.config.svg.namespaceIDs is falsy', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    shape.spriter.config.svg.namespaceIDs = false;
    shape._namespaced = true;
    shape.resetNamespace();

    expect(shape._namespaced).toBe(true);
  });

  it('should change _namespaced if it is namespaced and this.spriter.config.svg.namespaceIDs is truthy', () => {
    expect.hasAssertions();

    const shape = createShape(TEST_FILE, TEST_SPRITER);
    shape.spriter.config.svg.namespaceIDs = true;
    shape._namespaced = true;
    shape.svg.ready = TEST_FILE.contents.toString();
    shape.resetNamespace();

    expect(shape._namespaced).toBe(false);
  });
});
