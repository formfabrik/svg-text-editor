<script setup>
import { computed, ref } from 'vue';
import SvgRichText from './SvgRichText.vue';
import SvgTextToolbar from './SvgTextToolbar.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  modelValue: { type: Array, default: () => [{ text: '' }] },
  width: { type: Number, default: 600 },
  height: { type: Number, default: 240 },
  padding: { type: Number, default: 20 },
  fontFamily: { type: String, default: 'sans-serif' },
  fontSize: { type: Number, default: 16 },
  fill: { type: String, default: '#000' },
  lineHeight: { type: Number, default: 1.25 },
  align: { type: String, default: 'left' },
  toolbar: {
    type: String,
    default: 'floating',
    validator: (value) => ['floating', 'inline', 'none'].includes(value),
  },
  fontOptions: {
    type: Array,
    default: () => [
      { label: 'Sans Serif', value: 'sans-serif' },
      { label: 'Serif', value: 'serif' },
      { label: 'Monospace', value: 'monospace' },
    ],
  },
});

const emit = defineEmits(['update:modelValue', 'selection', 'focus', 'blur', 'escape']);
const editor = ref(null);
const toolbarElement = ref(null);
const active = ref(false);
const selection = ref({ start: 0, end: 0, format: { mixed: {} } });

const textX = computed(() => props.padding);
const textY = computed(() => props.toolbar === 'floating' ? Math.max(props.padding, 64) : props.padding);
const textWidth = computed(() => Math.max(0, props.width - props.padding * 2));
const viewBox = computed(() => `0 0 ${props.width} ${props.height}`);

function handleSelection(value) {
  selection.value = value;
  emit('selection', value);
}

function handleFocus() {
  active.value = true;
  emit('focus');
}

function handleBlur(event) {
  queueMicrotask(() => {
    if (!toolbarElement.value?.contains(document.activeElement)) active.value = false;
  });
  emit('blur', event);
}

function toggle(property) {
  editor.value?.toggle(property);
  editor.value?.focus();
}

function setColor(fill) {
  editor.value?.format({ fill });
  editor.value?.focus();
}

async function setFont(family) {
  editor.value?.format({ family });
  if (document.fonts) {
    await Promise.all([
      document.fonts.load(`400 ${props.fontSize}px "${family}"`),
      document.fonts.load(`700 ${props.fontSize}px "${family}"`),
    ]);
    editor.value?.refresh();
  }
  editor.value?.focus();
}

defineExpose({
  focus: () => editor.value?.focus(),
  toggle: (property) => editor.value?.toggle(property),
  format: (patch) => editor.value?.format(patch),
  getFormat: () => editor.value?.getFormat(),
  getLayoutSnapshot: () => editor.value?.getLayoutSnapshot(),
  undo: () => editor.value?.undo(),
  redo: () => editor.value?.redo(),
  refresh: () => editor.value?.refresh(),
  editor: () => editor.value?.editor(),
});
</script>

<template>
  <div class="svg-rte">
    <div v-if="toolbar === 'inline'" ref="toolbarElement" class="svg-rte-inline-toolbar">
      <SvgTextToolbar
        :format="selection.format"
        :font-options="fontOptions"
        @toggle="toggle"
        @color="setColor"
        @font="setFont"
      >
        <slot name="toolbar" />
      </SvgTextToolbar>
    </div>

    <div class="svg-rte-stage">
      <Transition name="svg-rte-palette">
        <div
          v-if="toolbar === 'floating' && active"
          ref="toolbarElement"
          class="svg-rte-floating-toolbar"
        >
          <SvgTextToolbar
            :format="selection.format"
            :font-options="fontOptions"
            @toggle="toggle"
            @color="setColor"
            @font="setFont"
          >
            <slot name="toolbar" />
          </SvgTextToolbar>
        </div>
      </Transition>

      <svg
        class="svg-rte-canvas"
        :viewBox="viewBox"
        :aria-label="$attrs['aria-label'] || 'SVG-Texteditor'"
      >
        <SvgRichText
          ref="editor"
          :model-value="modelValue"
          :x="textX"
          :y="textY"
          :width="textWidth"
          :font-family="fontFamily"
          :font-size="fontSize"
          :fill="fill"
          :line-height="lineHeight"
          :align="align"
          editing
          :autofocus="false"
          @update:model-value="emit('update:modelValue', $event)"
          @selection="handleSelection"
          @focus="handleFocus"
          @blur="handleBlur"
          @escape="emit('escape')"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.svg-rte {
  width: 100%;
}

.svg-rte-inline-toolbar {
  margin-bottom: 8px;
}

.svg-rte-stage {
  position: relative;
}

.svg-rte-canvas {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
}

.svg-rte-floating-toolbar {
  position: absolute;
  z-index: 1;
  top: 10px;
  left: 50%;
  width: max-content;
  max-width: 100%;
  transform: translateX(-50%);
}

.svg-rte-palette-enter-active,
.svg-rte-palette-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.svg-rte-palette-enter-from,
.svg-rte-palette-leave-to {
  opacity: 0;
  transform: translate(-50%, -4px);
}
</style>
