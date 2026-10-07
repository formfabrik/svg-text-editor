<script setup>
const props = defineProps({
  format: { type: Object, default: () => ({ mixed: {} }) },
  fontOptions: {
    type: Array,
    default: () => [
      { label: 'Sans Serif', value: 'sans-serif' },
      { label: 'Serif', value: 'serif' },
      { label: 'Monospace', value: 'monospace' },
    ],
  },
});

defineEmits(['toggle', 'color', 'font']);

const isMixed = (property) => !!props.format.mixed?.[property];
const isActive = (property) => !isMixed(property) && !!props.format[property];
const optionLabel = (option) => typeof option === 'string' ? option : option.label;
const optionValue = (option) => typeof option === 'string' ? option : option.value;
const color = () => /^#[0-9a-f]{6}$/i.test(props.format.fill) ? props.format.fill : '#000000';
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
          v-for="option in fontOptions"
          :key="optionValue(option)"
          :value="optionValue(option)"
        >
          {{ optionLabel(option) }}
        </option>
      </select>
    </label>
    <slot />
  </div>
</template>

<style scoped>
.svg-rte-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  width: max-content;
  max-width: calc(100% - 16px);
  padding: 6px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  color: #172033;
  background: #fff;
  box-shadow: 0 8px 24px rgb(15 23 42 / 16%);
}

button,
label {
  min-height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  background: #fff;
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
