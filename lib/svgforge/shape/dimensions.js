/**
 Svgforge is a Node.js module for creating SVG sprites

 @see https://github.com/svgforge/svgforge
 @author svgforge (https://github.com/SpotlightOn)
 @copyright © 2026 svgforge
 @license MIT https://github.com/svgforge/svgforge/blob/main/LICENSE
 */

import {XMLSerializer} from '@xmldom/xmldom';
import {getDependency} from '../../deps.js';
import calculateSvgDimensions from '../utils/calculate-svg-dimensions.js';
import {isString, runWaterfall} from '../utils/index.js';

/**
 Return the dimensions of this shape

 @returns {object} Width and height of the shape
*/
export function getDimensions() {
  return {
    width: this.width,
    height: this.height,
  };
}

/**
 Set the dimensions of this shape

 @param {number} width New width value
 @param {number} height New height value
 @returns {SVGShape} Self reference
*/
export function setDimensions(width, height) {
  // Width/height may carry a unit suffix (e.g. '48px'), so keep `parseFloat`.
  // eslint-disable-next-line unicorn/prefer-number-coercion
  this.width = this._round(Math.max(0, Number.parseFloat(width)));
  this.dom.documentElement.setAttribute('width', this.width);
  // eslint-disable-next-line unicorn/prefer-number-coercion
  this.height = this._round(Math.max(0, Number.parseFloat(height)));
  this.dom.documentElement.setAttribute('height', this.height);
  return this;
}

/**
 Return the shape's viewBox (and set it if it doesn't exist yet)

 @param {number} width Optional width override
 @param {number} height Optional height override
 @returns {Array} Four-element viewBox array
*/
export function getViewbox(width, height) {
  if (!this.viewBox) {
    this.setViewbox(0, 0, width || this.width, height || this.height);
  }

  return this.viewBox;
}

/**
 Set the shape's viewBox

 @param {number} x X coordinate
 @param {number} y Y coordinate
 @param {number} width New shape width
 @param {number} height New shape height
 @returns {Array} Updated viewBox array
*/
export function setViewbox(x, y, width, height) {
  if (Array.isArray(x)) {
    // eslint-disable-next-line unicorn/prefer-number-coercion
    this.viewBox = x.map(n => Number.parseFloat(n));
    while (this.viewBox.length < 4) {
      this.viewBox.push(0);
    }
  } else {
    // eslint-disable-next-line unicorn/prefer-number-coercion -- ViewBox components use `parseFloat` semantics (empty strings yield NaN).
    this.viewBox = [x, y, width, height].map(n => Number.parseFloat(n));
  }

  this.dom.documentElement.setAttribute('viewBox', this.viewBox.join(' '));
  return this.viewBox;
}

/**
 Complement the SVG shape by adding dimensions, padding and meta data

 @param {(error: Error|null, shape: SVGShape) => void} cb Completion callback
*/
export function complement(cb) {
  runWaterfall([
    // Prepare dimensions
    this._complementDimensions.bind(this),

    // Set padding
    this._addPadding.bind(this),

    // Set meta data
    this._addMetadata.bind(this),
  ], error => {
    // Save the transformed state
    this.svg.ready = new XMLSerializer().serializeToString(this.dom.documentElement);
    cb(error, this);
  });
}

/**
 Complement the shape's dimensions

 @param {(error: Error|null) => void} cb Completion callback
*/
export function _complementDimensions(cb) {
  if (this.width && this.height) {
    this._setDimensions(cb);
  } else {
    this._determineDimensions(error => {
      if (error) {
        cb(error);
      } else {
        this._setDimensions(cb);
      }
    });
  }
}

/**
 Determine the shape's dimension by rendering it

 @param {(error: Error|null) => void} cb Completion callback
*/
export function _determineDimensions(cb) {
  // Try to use a viewBox attribute for image determination
  if (this.viewBox !== false) {
    this.width = this._round(this.viewBox[2]);
    this.height = this._round(this.viewBox[3]);
  }

  // If the viewBox attribute didn't suffice: Render the SVG image
  if (!this.width || !this.height) {
    try {
      const {width, height} = getDependency('calculate-svg-dimensions', calculateSvgDimensions)(this.getSVG(false));
      this.height = this._round(height);
      this.width = this._round(width);
      cb(null);
    } catch (error) {
      cb(error);
    }
  } else {
    cb(null);
  }
}

/**
 Round a number considering the given decimal place precision

 @param {number} n Number
 @returns {number} Rounded number
*/
export function _round(n) {
  return Math.round(n * this._precision) / this._precision;
}

/**
 Scale the shape if necessary

 @param {(error: Error|null) => void} cb Completion callback
*/
export function _setDimensions(cb) {
  // Ensure the original viewBox is set
  this.getViewbox(this.width, this.height);

  const isIncludePadding = ['padding', 'icon'].includes(this.config.spacing.box);
  const isForceScale = this.config.spacing.box === 'icon';
  const horizontalPadding = isIncludePadding * Math.max(0, this.config.spacing.padding.right + this.config.spacing.padding.left);
  const width = this.width + horizontalPadding;
  const verticalPadding = isIncludePadding * Math.max(0, this.config.spacing.padding.top + this.config.spacing.padding.bottom);
  const height = this.height + verticalPadding;

  // Does the shape need to be scaled?
  if (width > this.config.dimension.maxWidth || height > this.config.dimension.maxHeight || (isForceScale && width < this.config.dimension.maxWidth && height < this.config.dimension.maxHeight)) {
    const maxWidth = this.config.dimension.maxWidth - horizontalPadding;
    const maxHeight = this.config.dimension.maxHeight - verticalPadding;
    this._scale = Math.min(maxWidth / this.width, maxHeight / this.height);
    this.width = Math.min(maxWidth, this._round(this.width * this._scale));
    this.height = Math.min(maxHeight, this._round(this.height * this._scale));
  }

  // In "icon" box sizing mode: Resize bounding box and center shape by adding padding
  if (isForceScale) {
    const diffWidth = this.config.dimension.maxWidth - this.width - horizontalPadding;
    const diffHeight = this.config.dimension.maxHeight - this.height - verticalPadding;
    this.config.spacing.padding.left += diffWidth / 2;
    this.config.spacing.padding.right += diffWidth / 2;
    this.config.spacing.padding.top += diffHeight / 2;
    this.config.spacing.padding.bottom += diffHeight / 2;
  }

  const dimensions = this.getDimensions();

  for (const [attr, value] of Object.entries(dimensions)) {
    this.dom.documentElement.setAttribute(attr, value);
  }

  cb(null);
}

/**
 Add padding to this shape

 @param {(error: Error|null) => void} cb Completion callback
*/
export function _addPadding(cb) {
  const {padding} = this.config.spacing;

  if (padding.top || padding.right || padding.bottom || padding.left) {
  // Update viewBox
    const viewBox = this.getViewbox();
    viewBox[0] -= this.config.spacing.padding.left / this._scale;
    viewBox[1] -= this.config.spacing.padding.top / this._scale;
    viewBox[2] += (this.config.spacing.padding.right + this.config.spacing.padding.left) / this._scale;
    viewBox[3] += (this.config.spacing.padding.top + this.config.spacing.padding.bottom) / this._scale;
    this.setViewbox(viewBox.map(this._round.bind(this)));

    // Update dimensions
    this.setDimensions(this.width + this.config.spacing.padding.right + this.config.spacing.padding.left, this.height + this.config.spacing.padding.top + this.config.spacing.padding.bottom);
  }

  cb(null);
}

/**
 Add metadata to this shape

 @param {(error: Error|null) => void} cb Completion callback
*/
export function _addMetadata(cb) {
  const ariaLabelledBy = [];

  // Check if description meta data is available
  if ('description' in this.meta && isString(this.meta.description) && this.meta.description.length > 0) {
    this.description ||= this.dom.documentElement.insertBefore(this.dom.createElementNS(this.DEFAULT_SVG_NAMESPACE, 'desc'), this.dom.documentElement.firstChild);

    this.description.textContent = this.meta.description;
    this.description.setAttribute('id', `${this.id}-desc`);
    ariaLabelledBy.push(`${this.id}-desc`);
  }

  // Check if title meta data is available
  if ('title' in this.meta && isString(this.meta.title) && this.meta.title.length > 0) {
    this.title ||= this.dom.documentElement.insertBefore(this.dom.createElementNS(this.DEFAULT_SVG_NAMESPACE, 'title'), this.dom.documentElement.firstChild);

    this.title.textContent = this.meta.title;
    this.title.setAttribute('id', `${this.id}-title`);
    ariaLabelledBy.push(`${this.id}-title`);
  }

  if (ariaLabelledBy.length > 0) {
    this.dom.documentElement.setAttribute('aria-labelledby', ariaLabelledBy.join(' '));
  } else if (this.dom.documentElement.hasAttribute('aria-labelledby')) {
    this.dom.documentElement.removeAttribute('aria-labelledby');
  }

  cb(null);
}
