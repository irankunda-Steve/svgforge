import {Buffer} from 'node:buffer';
import File from 'vinyl';
import createShape from '../../../lib/svgforge/shape/index.js';
import {
  createMock,
  describe,
  expect,
  it,
} from '../../helpers/harness.js';

const TEST_SPRITER = {
  config: {
    shape: {
      meta: {},
      align: {},
    },
  },
  verbose: createMock(),
};
const TEST_FILE = new File({
  contents: Buffer.from('<svg></svg>'),
  path: 'test_path',
  base: '/test_base/',
  cwd: '/',
});

const makeShape = () => createShape(TEST_FILE, TEST_SPRITER);

describe('testing _replaceIdAndClassnameReferences()', () => {
  it('should replace ids if subs ids passed', () => {
    expect.hasAssertions();

    const shape = makeShape();
    const TEST_STRING = 'url(id1) url(id2)';
    const TEST_SUBS_IDS = {
      id1: 'NEW ID 1',
    };

    expect(shape._replaceIdAndClassnameReferences(TEST_STRING, TEST_SUBS_IDS, {}, false)).toBe('url(#NEW ID 1) url(id2)');
  });

  it('should not change string if subs ids is null', () => {
    expect.hasAssertions();

    const shape = makeShape();
    const TEST_STRING = 'url(id1) url(id2)';

    expect(shape._replaceIdAndClassnameReferences(TEST_STRING, null, {}, false)).toBe(TEST_STRING);
  });

  it('should substitute ids and class names in CSS selectors if selectors passed', () => {
    expect.hasAssertions();

    const shape = makeShape();
    const TEST_STRING = '.cls a#id { color: blue }';
    const TEST_SUBS_IDS = {'#id': 'NEW-ID'};
    const TEST_SUBS_CLASSNAMES = {'.cls': 'new-cls'};

    expect(shape._replaceIdAndClassnameReferences(TEST_STRING, TEST_SUBS_IDS, TEST_SUBS_CLASSNAMES, true)).toBe('.new-cls a#NEW-ID { color: blue }');
  });
});

describe('testing _replaceIdAndClassnameReferencesInCssSelectors()', () => {
  it('should substitute ids in CSS selectors', () => {
    expect.hasAssertions();

    const shape = makeShape();
    const TEST_STRING = 'a#id, #id:hover { color: blue }';
    const TEST_SUBS_IDS = {'#id': 'new-id'};

    expect(shape._replaceIdAndClassnameReferencesInCssSelectors(TEST_STRING, TEST_SUBS_IDS, {})).toBe('a#new-id, #new-id:hover { color: blue }');
  });

  it('should substitute class names in CSS selectors, longest first', () => {
    expect.hasAssertions();

    const shape = makeShape();
    const TEST_STRING = '.icon, .icon-large { color: blue }';
    const TEST_SUBS_CLASSNAMES = {'.icon': 'i', '.icon-large': 'i-lg'};

    expect(shape._replaceIdAndClassnameReferencesInCssSelectors(TEST_STRING, {}, TEST_SUBS_CLASSNAMES)).toBe('.i, .i-lg { color: blue }');
  });

  it('should substitute ids and class names in @media selector lists', () => {
    expect.hasAssertions();

    const shape = makeShape();
    const TEST_STRING = '@media screen { a#id.cls { color: blue } }';
    const TEST_SUBS_IDS = {'#id': 'new-id'};
    const TEST_SUBS_CLASSNAMES = {'.cls': 'new-cls'};

    expect(shape._replaceIdAndClassnameReferencesInCssSelectors(TEST_STRING, TEST_SUBS_IDS, TEST_SUBS_CLASSNAMES)).toBe('@media screen { a#new-id.new-cls { color: blue } }');
  });

  it('should leave @font-face and @keyframes selectors untouched', () => {
    expect.hasAssertions();

    const shape = makeShape();
    const TEST_STRING = '@font-face{font-family:x;src:url(a.woff)}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
    const TEST_SUBS_IDS = {'#id': 'new-id'};
    const TEST_SUBS_CLASSNAMES = {'.cls': 'new-cls'};

    expect(shape._replaceIdAndClassnameReferencesInCssSelectors(TEST_STRING, TEST_SUBS_IDS, TEST_SUBS_CLASSNAMES)).toBe(TEST_STRING);
  });

  it('should leave attribute selectors untouched', () => {
    expect.hasAssertions();

    const shape = makeShape();
    const TEST_STRING = 'a[href="#anchor"] { color: blue }';
    const TEST_SUBS_IDS = {'#anchor': 'new-anchor'};

    expect(shape._replaceIdAndClassnameReferencesInCssSelectors(TEST_STRING, TEST_SUBS_IDS, {})).toBe(TEST_STRING);
  });
});
