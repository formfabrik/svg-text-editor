<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
  toolbarMinWidth: { type: Number, default: 160 },
  fontOptions: {
    type: Array,
    default: () => [
      { label: 'Sans Serif', value: 'sans-serif' },
      { label: 'Serif', value: 'serif' },
      { label: 'Monospace', value: 'monospace' },
    ],
  },
  fontSizeOptions: {
    type: Array,
    default: () => [8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 64, 72],
  },
});

const emit = defineEmits(['update:modelValue', 'update:align', 'selection', 'focus', 'blur', 'escape']);
const root = ref(null);
const editor = ref(null);
const toolbarElement = ref(null);
const active = ref(false);
const selection = ref({ start: 0, end: 0, format: { mixed: {} } });
const currentAlign = ref(props.align);
let blurTimer = null;

watch(() => props.align, (value) => {
  currentAlign.value = value;
});

function containsFocus(target = document.activeElement) {
  const textarea = editor.value?.editor()?.ta;
  return root.value?.contains(target) || target === textarea;
}

function handleDocumentFocus(event) {
  if (active.value && !containsFocus(event.target)) active.value = false;
}

onMounted(() => document.addEventListener('focusin', handleDocumentFocus));

onBeforeUnmount(() => {
  if (blurTimer) clearTimeout(blurTimer);
  document.removeEventListener('focusin', handleDocumentFocus);
});

const textX = computed(() => props.padding);
const textY = computed(() => props.toolbar === 'floating' ? Math.max(props.padding, 64) : props.padding);
const textWidth = computed(() => Math.max(0, props.width - props.padding * 2));
const viewBox = computed(() => `0 0 ${props.width} ${props.height}`);
const rootStyle = computed(() => ({
  '--svg-rte-toolbar-min-width': `${props.toolbarMinWidth}px`,
}));

function handleSelection(value) {
  selection.value = value;
  emit('selection', value);
}

function handleFocus() {
  if (blurTimer) {
    clearTimeout(blurTimer);
    blurTimer = null;
  }
  active.value = true;
  emit('focus');
}

function handleBlur(event) {
  if (blurTimer) clearTimeout(blurTimer);
  blurTimer = setTimeout(() => {
    blurTimer = null;
    if (!containsFocus()) active.value = false;
  }, 0);
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

function setSize(size) {
  editor.value?.format({ size });
  editor.value?.focus();
}

function setAlign(align) {
  currentAlign.value = align;
  editor.value?.editor()?.setOptions({ align });
  emit('update:align', align);
  editor.value?.focus();
}

async function setFont(family) {
  editor.value?.format({ family });
  editor.value?.focus();
  if (document.fonts) {
    await Promise.all([
      document.fonts.load(`400 ${props.fontSize}px "${family}"`),
      document.fonts.load(`700 ${props.fontSize}px "${family}"`),
    ]);
    editor.value?.refresh();
  }
}

defineExpose({
  focus: () => editor.value?.focus(),
  toggle: (property) => editor.value?.toggle(property),
  format: (patch) => editor.value?.format(patch),
  setAlign,
  getFormat: () => editor.value?.getFormat(),
  getLayoutSnapshot: () => editor.value?.getLayoutSnapshot(),
  undo: () => editor.value?.undo(),
  redo: () => editor.value?.redo(),
  refresh: () => editor.value?.refresh(),
  editor: () => editor.value?.editor(),
});
</script>

<template>
  <div ref="root" class="svg-rte" :style="rootStyle">
    <div v-if="toolbar === 'inline'" ref="toolbarElement" class="svg-rte-inline-toolbar">
      <SvgTextToolbar
        :format="selection.format"
        :align="currentAlign"
        :font-options="fontOptions"
        :font-size-options="fontSizeOptions"
        @toggle="toggle"
        @color="setColor"
        @font="setFont"
        @size="setSize"
        @align="setAlign"
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
            :align="currentAlign"
            :font-options="fontOptions"
            :font-size-options="fontSizeOptions"
            @toggle="toggle"
            @color="setColor"
            @font="setFont"
            @size="setSize"
            @align="setAlign"
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
          :align="currentAlign"
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
  top: 8px;
  left: 8px;
  width: max-content;
  min-width: var(--svg-rte-toolbar-min-width);
  max-width: max(var(--svg-rte-toolbar-min-width), calc(100% - 16px));
}

.svg-rte-palette-enter-active,
.svg-rte-palette-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}

.svg-rte-palette-enter-from,
.svg-rte-palette-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
