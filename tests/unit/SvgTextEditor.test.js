import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SvgTextEditor } from '../../src/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const editors = [];

function createEditor(options = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  document.body.appendChild(svg);
  const editor = new SvgTextEditor(svg, options);
  editors.push(editor);
  return editor;
}

function lineTexts(editor) {
  return editor.lines.map((line) => editor.chars.slice(line.s, line.e).join(''));
}

describe('SvgTextEditor', () => {
  beforeEach(() => {
    globalThis.__testFontWidthFactors = {};
    globalThis.__unloadedTestFonts = new Set();
  });

  afterEach(() => {
    for (const editor of editors.splice(0)) editor.destroy();
    document.body.textContent = '';
    delete globalThis.__testFontWidthFactors;
    delete globalThis.__unloadedTestFonts;
  });

  it('normalizes line endings and preserves formatted runs', () => {
    const editor = createEditor({
      runs: [
        { text: 'Hallo\r\n', bold: true },
        { text: 'SVG', fill: '#2563eb' },
      ],
    });

    expect(editor.getText()).toBe('Hallo\nSVG');
    expect(editor.getRuns()).toEqual([
      {
        text: 'Hallo\n',
        bold: true,
        italic: false,
        underline: false,
        strike: false,
        fill: '#000',
        size: 16,
        family: 'sans-serif',
      },
      {
        text: 'SVG',
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        fill: '#2563eb',
        size: 16,
        family: 'sans-serif',
      },
    ]);
  });

  it('wraps words within the configured width', () => {
    const editor = createEditor({
      text: 'aaaa aaaa aaaa',
      width: 55,
      fontSize: 10,
    });

    expect(lineTexts(editor)).toEqual(['aaaa aaaa ', 'aaaa']);
  });

  it('reports mixed formats and applies a toggle to the whole selection', () => {
    const editor = createEditor({
      runs: [
        { text: 'A' },
        { text: 'B', bold: true, fill: '#2563eb' },
      ],
    });
    editor.anchor = 0;
    editor.head = 2;

    expect(editor.getFormat()).toMatchObject({
      bold: false,
      mixed: { bold: true, fill: true },
    });

    editor.toggle('bold');

    expect(editor.getRuns().every((run) => run.bold)).toBe(true);
    expect(editor.getFormat().mixed.bold).toBeUndefined();
  });

  it('creates a serializable word-level layout snapshot', () => {
    const editor = createEditor({
      runs: [
        { text: 'Hallo ' },
        { text: 'SVG', bold: true, fill: '#2563eb' },
      ],
      x: 40,
      y: 20,
      width: 100,
      fontSize: 10,
    });

    const snapshot = editor.getLayoutSnapshot();

    expect(snapshot).toMatchObject({
      version: 1,
      layout: {
        x: 40,
        y: 20,
        width: 100,
        fontSize: 10,
      },
      styles: [
        {
          bold: false,
          fill: '#000',
          size: 10,
          family: 'sans-serif',
        },
        {
          bold: true,
          fill: '#2563eb',
          size: 10,
          family: 'sans-serif',
        },
      ],
      lines: [
        {
          start: 0,
          end: 9,
          segments: [
            {
              text: 'Hallo ',
              start: 0,
              end: 6,
              fragments: [{ text: 'Hallo ', styleId: 0 }],
            },
            {
              text: 'SVG',
              start: 6,
              end: 9,
              fragments: [
                {
                  text: 'SVG',
                  styleId: 1,
                },
              ],
            },
          ],
        },
      ],
    });
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });

  it('restores text changes with undo and redo', () => {
    const editor = createEditor({ text: 'SVG' });
    editor.anchor = editor.head = editor.getText().length;

    editor._insertText(' Text');
    expect(editor.getText()).toBe('SVG Text');

    editor.undoOp();
    expect(editor.getText()).toBe('SVG');

    editor.redoOp();
    expect(editor.getText()).toBe('SVG Text');
  });

  it('remeasures wrapping after a dynamically loaded font becomes available', () => {
    globalThis.__testFontWidthFactors = {
      Caveat: 0.5,
      'Noto Sans': 1,
    };
    globalThis.__unloadedTestFonts.add('Noto Sans');

    const editor = createEditor({
      runs: [{ text: 'aaaa aaaa aaaa', family: 'Caveat' }],
      width: 55,
      fontSize: 10,
    });
    editor.anchor = 0;
    editor.head = editor.getText().length;
    editor.format({ family: 'Noto Sans' });

    expect(editor.lines).toHaveLength(2);

    globalThis.__unloadedTestFonts.delete('Noto Sans');
    editor.refresh();

    expect(lineTexts(editor)).toEqual(['aaaa ', 'aaaa ', 'aaaa']);
  });
});
