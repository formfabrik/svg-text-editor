<script setup>
import { computed, ref } from 'vue';
import { SvgRichText, SvgRichTextEditor } from '../src/vue/index.js';

const editor = ref(null);
const svg = ref(null);
const editorX = 40;
const editorWidth = ref(500);
const resizing = ref(false);
const selection = ref({ start: 0, end: 0, format: {} });
const layoutSnapshot = ref(null);
const moduleRuns = ref([
  { text: 'Klicke in diesen Editor. ' },
  { text: 'Die Palette erscheint automatisch.', bold: true },
]);
const runs = ref([
  { text: 'Hallo ' },
  { text: 'SVG', bold: true, fill: '#2563eb' },
  {
    text: '-Editor! Dieser Fliesstext bricht automatisch um. Markiere Text und formatiere ihn mit der Werkzeugleiste.',
  },
]);

const selectedLength = computed(() => selection.value.end - selection.value.start);
const currentColor = computed(() => {
  const fill = selection.value.format.fill;
  return /^#[0-9a-f]{6}$/i.test(fill) ? fill : '#000000';
});
const currentFont = computed(() => selection.value.format.family || 'sans-serif');

function isActive(property) {
  return !isMixed(property) && !!selection.value.format[property];
}

function isMixed(property) {
  return !!selection.value.format.mixed?.[property];
}

function toggle(property) {
  editor.value?.toggle(property);
  editor.value?.focus();
}

function captureSnapshot() {
  layoutSnapshot.value = editor.value?.getLayoutSnapshot() ?? null;
}

function setColor(event) {
  editor.value?.format({ fill: event.target.value });
  captureSnapshot();
  editor.value?.focus();
}

async function setFont(event) {
  const family = event.target.value;
  editor.value?.format({ family });
  await Promise.all([
    document.fonts.load(`400 22px "${family}"`),
    document.fonts.load(`700 22px "${family}"`),
  ]);
  editor.value?.refresh();
  captureSnapshot();
  editor.value?.focus();
}

function setEditorWidth(width) {
  editorWidth.value = Math.min(620, Math.max(160, width));
}

function resizeToPointer(event) {
  if (!resizing.value) return;
  const matrix = svg.value?.getScreenCTM();
  if (!matrix) return;

  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  setEditorWidth(point.x - editorX);
}

function startResize(event) {
  resizing.value = true;
  event.currentTarget.setPointerCapture(event.pointerId);
  resizeToPointer(event);
}

function stopResize(event) {
  resizing.value = false;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  captureSnapshot();
  editor.value?.focus();
}

function resizeWithKeyboard(event) {
  const step = event.shiftKey ? 50 : 10;
  if (event.key === 'ArrowLeft') setEditorWidth(editorWidth.value - step);
  else if (event.key === 'ArrowRight') setEditorWidth(editorWidth.value + step);
  else if (event.key === 'Home') setEditorWidth(160);
  else if (event.key === 'End') setEditorWidth(620);
  else return;
  event.preventDefault();
}
</script>

<template>
  <main>
    <h1>SVG Text Editor</h1>

    <div class="toolbar">
      <button
        type="button"
        title="Fett"
        :class="{ active: isActive('bold'), mixed: isMixed('bold') }"
        :aria-pressed="isMixed('bold') ? 'mixed' : isActive('bold')"
        @mousedown.prevent="toggle('bold')"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        title="Kursiv"
        :class="{ active: isActive('italic'), mixed: isMixed('italic') }"
        :aria-pressed="isMixed('italic') ? 'mixed' : isActive('italic')"
        @mousedown.prevent="toggle('italic')"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        title="Unterstrichen"
        :class="{ active: isActive('underline'), mixed: isMixed('underline') }"
        :aria-pressed="isMixed('underline') ? 'mixed' : isActive('underline')"
        @mousedown.prevent="toggle('underline')"
      >
        <u>U</u>
      </button>
      <label :class="{ mixed: isMixed('fill') }">
        Textfarbe
        <input type="color" :value="currentColor" @input="setColor">
        <span v-if="isMixed('fill')" class="mixed-label">gemischt</span>
      </label>
      <label :class="{ mixed: isMixed('family') }">
        Schrift
        <select :value="currentFont" @change="setFont">
          <option value="sans-serif">System Sans</option>
          <option value="Roboto">Roboto</option>
          <option value="Lora">Lora</option>
          <option value="Roboto Slab">Roboto Slab</option>
          <option value="Caveat">Caveat</option>
          <option value="Noto Sans">Noto Sans</option>
        </select>
        <span v-if="isMixed('family')" class="mixed-label">gemischt</span>
      </label>
      <span class="selection-status">
        {{
          selectedLength
            ? `${selectedLength} Zeichen ausgewählt`
            : `Cursor: ${selection.start}`
        }}
      </span>
      <output>Breite: {{ Math.round(editorWidth) }} px</output>
    </div>

    <svg ref="svg" viewBox="0 0 700 320" aria-label="SVG-Texteditor">
      <rect
        class="editor-boundary"
        :x="editorX"
        y="20"
        :width="editorWidth"
        height="280"
      />
      <SvgRichText
        ref="editor"
        v-model="runs"
        :x="editorX"
        :y="40"
        :width="editorWidth"
        :font-size="22"
        editing
        @selection="selection = $event"
        @blur="captureSnapshot"
      />
      <line
        class="resize-line"
        :class="{ active: resizing }"
        :x1="editorX + editorWidth"
        :x2="editorX + editorWidth"
        y1="20"
        y2="300"
      />
      <rect
        class="resize-handle"
        :class="{ active: resizing }"
        :x="editorX + editorWidth - 6"
        y="20"
        width="12"
        height="280"
        role="slider"
        tabindex="0"
        aria-label="Breite des Textfelds"
        aria-valuemin="160"
        aria-valuemax="620"
        :aria-valuenow="Math.round(editorWidth)"
        @pointerdown.stop.prevent="startResize"
        @pointermove.stop.prevent="resizeToPointer"
        @pointerup.stop.prevent="stopResize"
        @pointercancel.stop.prevent="stopResize"
        @keydown="resizeWithKeyboard"
      />
    </svg>

    <h2>Aktueller Inhalt</h2>
    <pre>{{ JSON.stringify(runs, null, 2) }}</pre>

    <h2>Layout-Snapshot</h2>
    <p v-if="!layoutSnapshot">
      Setze den Fokus außerhalb des Editors, um den Snapshot zu erzeugen.
    </p>
    <pre v-else>{{ JSON.stringify(layoutSnapshot, null, 2) }}</pre>

    <h2>Einbettbare Vue-Komponente</h2>
    <SvgRichTextEditor
      v-model="moduleRuns"
      :width="700"
      :height="220"
      :font-size="20"
      toolbar="floating"
      :font-options="[
        { label: 'Roboto', value: 'Roboto' },
        { label: 'Lora', value: 'Lora' },
        { label: 'Noto Sans', value: 'Noto Sans' },
      ]"
    />
  </main>
</template>
