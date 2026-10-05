// Мини-помощник для разметки хаба без фреймворка.

type Attrs = Record<string, string | boolean | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) if (child) el.append(child);
  return el;
}

/** SVG-иконка из строки разметки (иконки — свои, из hub/ui/icons.ts). */
export function icon(svg: string, className?: string): HTMLSpanElement {
  const span = h('span', { class: className ? `icon ${className}` : 'icon', 'aria-hidden': 'true' });
  span.innerHTML = svg;
  return span;
}
