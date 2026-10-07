# svg-text-editor

Native SVG rich-text editing for Vue 3. Text, cursor, selection and line wrapping
are rendered directly in SVG without `foreignObject`.

## Installation

```bash
npm install svg-text-editor@beta
```

Import the component styles once in the application entry:

```js
import 'svg-text-editor/style.css';
```

## Editor with toolbar

```vue
<script setup>
import { ref } from 'vue';
import { SvgRichTextEditor } from 'svg-text-editor/vue';

const runs = ref([
  { text: 'Editable ' },
  { text: 'SVG text', bold: true, fill: '#2563eb' },
]);
</script>

<template>
  <SvgRichTextEditor
    v-model="runs"
    :width="700"
    :height="260"
    :font-size="22"
    toolbar="floating"
  />
</template>
```

`toolbar` accepts:

- `floating`: appears inside the editor after it receives focus
- `inline`: stays above the SVG
- `none`: renders only the editor

Custom font choices can be supplied without bundling fonts into the library:

```vue
<SvgRichTextEditor
  v-model="runs"
  :font-options="[
    { label: 'Inter', value: 'Inter' },
    { label: 'Noto Sans', value: 'Noto Sans' },
  ]"
/>
```

The host application is responsible for loading these fonts before export.

## Editor inside an existing SVG

Use the low-level component when the text must be part of an existing SVG:

```vue
<script setup>
import { ref } from 'vue';
import { SvgRichText, SvgTextToolbar } from 'svg-text-editor/vue';

const editor = ref();
const runs = ref([{ text: 'SVG text' }]);
const selection = ref({ format: { mixed: {} } });
</script>

<template>
  <SvgTextToolbar
    :format="selection.format"
    @toggle="editor.toggle($event)"
    @color="editor.format({ fill: $event })"
  />
  <svg viewBox="0 0 800 300">
    <SvgRichText
      ref="editor"
      v-model="runs"
      :x="40"
      :y="40"
      :width="500"
      editing
      @selection="selection = $event"
    />
  </svg>
</template>
```

## Framework-independent core

```js
import { SvgTextEditor } from 'svg-text-editor';

const editor = new SvgTextEditor(svgElement, {
  width: 500,
  runs,
});
```

Both Vue editor components expose `focus`, `toggle`, `format`, `undo`, `redo`,
`refresh`, `getFormat`, `getLayoutSnapshot` and the underlying editor instance.
