
import fixXMLString from '../../../lib/svgforge/utils/fix-xml-string.js';
import XmlFixingError from '../../../lib/svgforge/errors/xml-fixing-error.js';
import {describe, expect, it} from '../../helpers/harness.js';

describe('testing fixing svg string', () => {
  it('should return valid svg file on svg with one multiline attribute values', () => {
    expect(fixXMLString(`<svg viewBox="0 0 16
                                     16"></svg>`)).toBe('<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"/>');
  });

  it('should return valid svg file on svg with few multiline attribute values', () => {
    expect(fixXMLString(`<svg fill="r
                                                            e
                                                            d"
                                                            viewBox="0 0 16
                                                                                                 16"></svg>`)).toBe('<svg fill="r e d" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"/>');
  });

  it('should return valid svg file on svg with multiple multiline attribute values', () => {
    expect(fixXMLString(`<svg fill="r
                                                            e
                                                            d"
                                                            viewBox="0
                                                            0
                                                            16
                                                            16"></svg>`)).toBe('<svg fill="r e d" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"/>');
  });

  it('should return same string on valid svg', () => {
    expect(fixXMLString('<svg viewBox="0 0 16 16"></svg>')).toBe('<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"/>');
  });

  it('should throw an error on invalid file', () => {
    expect(() => {
      fixXMLString('<svg viewBox=></svg>');
    }).toThrow(XmlFixingError);
  });

  it('should keep the generic message and attach the parser error as the cause', () => {
    let thrown;

    try {
      fixXMLString('<svg viewBox=></svg>');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(XmlFixingError);
    expect(thrown.message).toBe('Invalid XML string');
    expect(thrown.cause).toBeInstanceOf(Error);
    expect(thrown.cause.message.length).toBeGreaterThan(0);
  });
});
