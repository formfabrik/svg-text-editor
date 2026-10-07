<script setup>
import { computed } from 'vue';

const props = defineProps({
  format: { type: Object, default: () => ({ mixed: {} }) },
  align: {
    type: String,
    default: 'left',
    validator: (value) => ['left', 'center', 'right'].includes(value),
  },
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

const emit = defineEmits(['toggle', 'color', 'font', 'size', 'align']);

const isMixed = (property) => !!props.format.mixed?.[property];
const isActive = (property) => !isMixed(property) && !!props.format[property];
const optionLabel = (option) => typeof option === 'string' ? option : option.label;
const optionValue = (option) => typeof option === 'string' ? option : option.value;
const color = () => /^#[0-9a-f]{6}$/i.test(props.format.fill) ? props.format.fill : '#000000';
const displayedFontOptions = computed(() => {
  const options = [...props.fontOptions];
  const family = props.format.family;
  if (family && !options.some((option) => optionValue(option) === family)) {
    options.unshift({ label: family, value: family });
  }
  return options;
});
const displayedFontSizeOptions = computed(() => {
  const sizes = props.fontSizeOptions.map(Number).filter((size) => Number.isFinite(size) && size > 0);
  const currentSize = Number(props.format.size);
  if (Number.isFinite(currentSize) && currentSize > 0 && !sizes.includes(currentSize)) {
    sizes.push(currentSize);
  }
  return [...new Set(sizes)].sort((a, b) => a - b);
});

function setSize(event) {
  if (event.target.value) emit('size', Number(event.target.value));
}
</script>

<template>
  <div class="svg-rte-toolbar" role="toolbar" aria-label="Textformatierung">
    <button
      type="button"
      title="Fett"
      :class="{ active: isActive('bold'), mixed: isMixed('bold') }"
      :aria-pressed="isMixed('bold') ? 'mixed' : isActive('bold')"
      @mousedown.prevent="$emit('toggle', 'bold')"
    >
      <strong>B</strong>
    </button>
    <button
      type="button"
      title="Kursiv"
      :class="{ active: isActive('italic'), mixed: isMixed('italic') }"
      :aria-pressed="isMixed('italic') ? 'mixed' : isActive('italic')"
      @mousedown.prevent="$emit('toggle', 'italic')"
    >
      <em>I</em>
    </button>
    <button
      type="button"
      title="Unterstrichen"
      :class="{ active: isActive('underline'), mixed: isMixed('underline') }"
      :aria-pressed="isMixed('underline') ? 'mixed' : isActive('underline')"
      @mousedown.prevent="$emit('toggle', 'underline')"
    >
      <u>U</u>
    </button>
    <span class="svg-rte-align-group">
      <button
        v-for="value in ['left', 'center', 'right']"
        :key="value"
        type="button"
        :title="{ left: 'Linksbündig', center: 'Zentriert', right: 'Rechtsbündig' }[value]"
        :class="{ active: align === value }"
        :aria-label="{ left: 'Linksbündig', center: 'Zentriert', right: 'Rechtsbündig' }[value]"
        :aria-pressed="align === value"
        @mousedown.prevent="$emit('align', value)"
      >
        <span class="svg-rte-align-icon" :class="`align-${value}`" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
    </span>
    <label :class="{ mixed: isMixed('fill') }">
      <span class="sr-only">Textfarbe</span>
      <input
        type="color"
        :value="color()"
        aria-label="Textfarbe"
        @input="$emit('color', $event.target.value)"
      >
    </label>
    <label v-if="fontOptions.length" :class="{ mixed: isMixed('family') }">
      <span class="sr-only">Schriftart</span>
      <select
        :value="format.family"
        aria-label="Schriftart"
        @change="$emit('font', $event.target.value)"
      >
        <option
          v-for="option in displayedFontOptions"
          :key="optionValue(option)"
          :value="optionValue(option)"
        >
          {{ optionLabel(option) }}
        </option>
      </select>
    </label>
    <label v-if="fontSizeOptions.length" :class="{ mixed: isMixed('size') }">
      <span class="sr-only">Schriftgröße</span>
      <select
        :value="isMixed('size') ? '' : format.size"
        aria-label="Schriftgröße"
        @change="setSize"
      >
        <option v-if="isMixed('size')" value="">–</option>
        <option v-for="size in displayedFontSizeOptions" :key="size" :value="size">
          {{ size }} px
        </option>
      </select>
    </label>
    <slot />
  </div>
</template>

<style scoped>
.svg-rte-toolbar {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: center;
  width: 100%;
  max-width: 100%;
  padding: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #172033;
  background: #fff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 16%);
}

button,
label {
  flex: 0 0 auto;
  min-height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  background: #fff;
}

.svg-rte-align-group {
  display: flex;
  flex: 0 0 auto;
  gap: 3px;
}

.svg-rte-align-icon {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 16px;
}

.svg-rte-align-icon i {
  display: block;
  width: 16px;
  height: 2px;
  border-radius: 1px;
  background: currentColor;
}

.svg-rte-align-icon i:nth-child(2) {
  width: 11px;
}

.svg-rte-align-icon.align-left {
  align-items: flex-start;
}

.svg-rte-align-icon.align-center {
  align-items: center;
}

.svg-rte-align-icon.align-right {
  align-items: flex-end;
}

button {
  min-width: 32px;
  padding: 4px 8px;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

button:hover,
label:focus-within {
  border-color: #2563eb;
}

button.active {
  border-color: #1d4ed8;
  color: #fff;
  background: #2563eb;
}

button.mixed,
label.mixed {
  border-color: #2563eb;
  background: linear-gradient(135deg, #bfdbfe 50%, #fff 50%);
}

label {
  display: flex;
  align-items: center;
  padding: 3px 5px;
}

input {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
}

select {
  max-width: 140px;
  border: 0;
  outline: 0;
  color: inherit;
  background: transparent;
  font: inherit;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
