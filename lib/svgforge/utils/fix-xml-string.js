import {DOMParser} from '@xmldom/xmldom';
import XmlFixingError from '../errors/xml-fixing-error.js';

/**
 Fix an SVG string and normalize its whitespace

 @param {string} svgString svg string to fix
 @returns {string} fixed svg string
 @throws {XmlFixingError} if the string is not valid XML
 */
export default function fixXMLString(svgString) {
  try {
    return new DOMParser({
      // Silence xmldom's default `console.error` reporting. Parsing still
      // throws for fatal errors, and the reason is preserved as the cause.
      onError() {
        // Reported through the thrown error below instead of the console
      },
    })
      .parseFromString(svgString, 'image/svg+xml')
      .toString()
      .replaceAll(/\s{2,}/gu, ' ');
  } catch (error) {
    throw new XmlFixingError('Invalid XML string', {cause: error});
  }
}
