
import {Buffer} from 'node:buffer';
import File from 'vinyl';
import SVGSprite from '../../lib/svgforge/sprite.js';
import {
  createMock,
  describe,
  expect,
  it,
  spyOn,
} from '../helpers/harness.js';

describe('testing SVGSprite', () => {
  describe('testing initial settings', () => {
    it('should set initial attributes', () => {
      expect.hasAssertions();

      const TEST_TRANSFORM = [createMock()];
      const sprite = new SVGSprite('', '', {}, false, TEST_TRANSFORM);

      expect(sprite.transform).toBe(TEST_TRANSFORM);
      expect(sprite.content).toStrictEqual([]);
      expect(sprite._serialized).toBeNull();

      expect(sprite.DEFAULT_SVG_NAMESPACE).toBe('http://www.w3.org/2000/svg');
      expect(sprite.XLINK_NAMESPACE).toBe('http://www.w3.org/1999/xlink');
    });

    it('should set xmlDeclaration', () => {
      expect.hasAssertions();

      const TEST_XML_DECLARATION = 'xml';
      const sprite = new SVGSprite(TEST_XML_DECLARATION, '', {}, false, []);

      expect(sprite.xmlDeclaration).toBe(TEST_XML_DECLARATION);
    });

    it('should set empty xmlDeclaration', () => {
      expect.hasAssertions();

      const sprite = new SVGSprite(false, '', {}, false, []);

      expect(sprite.xmlDeclaration).toBe('');
    });

    it('should set doctypeDeclaration', () => {
      expect.hasAssertions();

      const TEST_DOCTYPE_DECLARATION = 'doctype';
      const sprite = new SVGSprite('', TEST_DOCTYPE_DECLARATION, {}, false, []);

      expect(sprite.doctypeDeclaration).toBe(TEST_DOCTYPE_DECLARATION);
    });

    it('should set empty doctypeDeclaration', () => {
      expect.hasAssertions();

      const sprite = new SVGSprite(false, false, {}, false, []);

      expect(sprite.doctypeDeclaration).toBe('');
    });

    it('should add namespaces', () => {
      expect.hasAssertions();

      const sprite = new SVGSprite(false, false, {}, true, []);

      expect(sprite.rootAttributes.xmlns).toBe(sprite.DEFAULT_SVG_NAMESPACE);
      expect(sprite.rootAttributes['xmlns:xlink']).toBe(sprite.XLINK_NAMESPACE);
    });

    it('should not add namespaces', () => {
      expect.hasAssertions();

      const sprite = new SVGSprite(false, false, {}, false, []);

      expect(sprite.rootAttributes).not.toHaveProperty('xmlns');
      expect(sprite.rootAttributes).not.toHaveProperty('xmlns:xlink');
    });
  });

  describe('testing add()', () => {
    it('should push to content if array is passed', () => {
      expect.hasAssertions();

      const TEST_CONTENT = ['<svg/>'];
      const sprite = new SVGSprite(false, false, {}, false, []);

      sprite.add(TEST_CONTENT);

      expect(sprite.content).toStrictEqual(TEST_CONTENT);
      expect(sprite._serialized).toBeNull();
    });

    it.each([false, true, {}, createMock(), Symbol(''), 1, null, undefined, 'string'])('should not push to content if %p passed', parameter => {
      expect.hasAssertions();

      const sprite = new SVGSprite(false, false, {}, false, []);

      sprite.add(parameter);

      expect(sprite.content).toStrictEqual([parameter]);
      expect(sprite._serialized).toBeNull();
    });
  });

  describe('testing toString()', () => {
    it('should return serialized content', () => {
      expect.hasAssertions();

      const TEST_CONTENT = 'test content';
      const sprite = new SVGSprite(false, false, {}, false, []);

      sprite._serialized = TEST_CONTENT;

      expect(sprite.toString()).toBe(TEST_CONTENT);
    });

    it('should serialize according to rootAttributes', () => {
      expect.hasAssertions();

      const TEST_ROOT_ATTRS = {ATTR_1: 1, ATTR_2: 2};
      const sprite = new SVGSprite(false, false, TEST_ROOT_ATTRS, false, []);
      sprite.content = ['content'];
      const expected = `<svg ATTR_1="1" ATTR_2="2">${sprite.content[0]}</svg>`;

      expect(sprite.toString()).toBe(expected);
      expect(sprite._serialized).toBe(expected);
    });

    it('should escape special characters in root attributes', () => {
      expect.hasAssertions();

      const sprite = new SVGSprite(false, false, {title: 'A&B <tag> "q" \'s\''}, false, []);
      sprite.content = ['content'];
      const expected = '<svg title="A&amp;B &lt;tag&gt; &quot;q&quot; &#39;s&#39;">content</svg>';

      expect(sprite.toString()).toBe(expected);
    });

    it('should transform svg in series', () => {
      expect.hasAssertions();

      const TEST_TRANSFORM = [createMock().mockReturnValueOnce(false), createMock().mockReturnValueOnce('TEST')];
      const sprite = new SVGSprite(false, false, {}, false, TEST_TRANSFORM);
      const expected = 'TEST';

      expect(sprite.toString()).toBe(expected);
      expect(sprite._serialized).toBe(expected);

      expect(TEST_TRANSFORM[0]).toHaveBeenCalledWith('<svg></svg>');
      expect(TEST_TRANSFORM[1]).toHaveBeenCalledWith('');
    });
  });

  describe('testing toFile()', () => {
    it('should return file', () => {
      expect.hasAssertions();

      const TEST_CONTENT = 'TEST';
      const TEST_BASE = 'TEST_BASE';
      const TEST_PATH = 'TEST_PATH';
      const sprite = new SVGSprite(false, false, {}, false, []);
      spyOn(sprite, 'toString').mockReturnValueOnce(TEST_CONTENT);

      expect(sprite.toFile(TEST_BASE, TEST_PATH)).toStrictEqual(new File({
        base: TEST_BASE,
        path: TEST_PATH,
        contents: Buffer.from(TEST_CONTENT),
      }));
    });
  });
});
