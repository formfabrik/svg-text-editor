const getFontSize = (element) => Number(element.getAttribute('font-size')) || 16;
const getFontFamily = (element) => element.getAttribute('font-family') || 'sans-serif';

const getWidthFactor = (element) => {
  const family = getFontFamily(element);
  if (globalThis.__unloadedTestFonts?.has(family)) return 0.5;
  return globalThis.__testFontWidthFactors?.[family] ?? 0.5;
};

const measure = (element, text = element.textContent || '') =>
  Array.from(text).length * getFontSize(element) * getWidthFactor(element);

const findPrototype = (element, constructorName) => {
  let prototype = Object.getPrototypeOf(element);
  while (prototype && prototype.constructor?.name !== constructorName) {
    prototype = Object.getPrototypeOf(prototype);
  }
  if (!prototype) throw new Error(`Missing ${constructorName} prototype`);
  return prototype;
};

const textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
const textContentPrototype = findPrototype(textElement, 'SVGTextContentElement');
const graphicsPrototype = findPrototype(textElement, 'SVGGraphicsElement');

Object.defineProperties(textContentPrototype, {
  getComputedTextLength: {
    configurable: true,
    value() {
      return measure(this);
    },
  },
  getNumberOfChars: {
    configurable: true,
    value() {
      return Array.from(this.textContent || '').length;
    },
  },
  getExtentOfChar: {
    configurable: true,
    value(index) {
      const width = getFontSize(this) * getWidthFactor(this);
      return { x: index * width, y: 0, width, height: getFontSize(this) };
    },
  },
});

Object.defineProperty(graphicsPrototype, 'getBBox', {
  configurable: true,
  value() {
    return { x: 0, y: 0, width: measure(this), height: getFontSize(this) };
  },
});
