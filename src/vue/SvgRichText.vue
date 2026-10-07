<!--
  Verwendung (innerhalb eines <svg>):
  <svg viewBox="0 0 800 600">
    <SvgRichText ref="rt" v-model="runs" :x="40" :y="40" :width="360" :font-size="20"
                 :editing="editing" @blur="editing = false" />
  </svg>
  Toolbar: rt.value.toggle('bold'), rt.value.format({ fill: '#f00' }) – Toolbar-Buttons mit @mousedown.prevent,
  damit der Fokus im Editor bleibt.
-->
<template>
  <g ref="root" />
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { SvgTextEditor } from '../core/SvgTextEditor.js';

const props = defineProps({
  modelValue: { type: Array, default: () => [{ text: '' }] }, // Runs: [{ text, bold?, italic?, underline?, strike?, fill?, size?, family? }]
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  width: { type: Number, default: null }, // null = kein automatischer Umbruch
  fontFamily: { type: String, default: 'sans-serif' },
  fontSize: { type: Number, default: 16 },
  fill: { type: String, default: '#000' },
  lineHeight: { type: Number, default: 1.25 },
  align: { type: String, default: 'left' },
  editing: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'selection', 'blur', 'escape']);

const root = ref(null);
let ed = null;
let lastEmitted = null;

const options = () => ({
  x: props.x, y: props.y, width: props.width, fontFamily: props.fontFamily, fontSize: props.fontSize,
  fill: props.fill, lineHeight: props.lineHeight, align: props.align,
});

onMounted(() => {
  ed = new SvgTextEditor(root.value, {
    ...options(),
    runs: props.modelValue,
    onChange: (runs) => { lastEmitted = runs; emit('update:modelValue', runs); },
    onSelection: (s) => emit('selection', s),
    onBlur: () => emit('blur'),
    onEscape: () => emit('escape'),
  });
  if (props.editing) ed.startEditing();
});

onBeforeUnmount(() => ed && ed.destroy());

watch(() => props.modelValue, (v) => { if (ed && v !== lastEmitted) ed.setRuns(v); }, { deep: false });
watch(() => props.editing, (v) => ed && (v ? ed.startEditing() : ed.stopEditing()));
watch(options, (o) => ed && ed.setOptions(o));

defineExpose({
  toggle: (p) => ed && ed.toggle(p),
  format: (p) => ed && ed.format(p),
  getFormat: () => ed && ed.getFormat(),
  getLayoutSnapshot: () => ed && ed.getLayoutSnapshot(),
  undo: () => ed && ed.undoOp(),
  redo: () => ed && ed.redoOp(),
  focus: () => ed && ed.focus(),
  refresh: () => ed && ed.refresh(),
  editor: () => ed, // Zugriff auf die Instanz, z. B. ed.textGroup für den Export
});
</script>
