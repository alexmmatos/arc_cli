/** Mermaid node/class ids must be alphanumeric/underscore. */
export function slug(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

/** Escapes a flowchart node/edge label. Mermaid renders labels as HTML, so unescaped `<`/`>` can vanish as a bogus tag. */
export function escapeFlowLabel(label: string): string {
  return label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Sanitizes text for a Mermaid sequenceDiagram message/participant label.
 * Unlike flowchart, raw `<`/`>`/`{`/`}`/`:`/`|` are all fine here (verified
 * against the real mermaid renderer) — but HTML-escaping them is NOT: the
 * sequence parser decodes entities back to literal chars before
 * re-tokenizing, so `&lt;` trips it up worse than a raw `<` would. The only
 * real hazard is a literal newline, since a message must stay on one line.
 */
export function sequenceSafeText(text: string): string {
  return text.replace(/\n/g, ' ');
}

/**
 * Converts a TypeScript type string into something safe to place in a
 * Mermaid classDiagram member line, where `< > { } | :` are reserved.
 * Heuristic only: generics become Mermaid's `~T~` form (dropped if they
 * contain a comma, since Mermaid generics can't); unions become "or";
 * object-literal types collapse to "object"; anything still unsafe is
 * stripped as a last resort.
 * ponytail: single-level generics only (Promise<Array<T>> loses its inner
 * brackets) — upgrade to a real type-string parser if that starts misleading.
 */
export function mermaidSafeType(raw: string): string {
  let t = raw.trim();
  if (t.includes('{')) return 'object';

  t = t.replace(/\s*\|\s*/g, ' or ');
  t = t.replace(/<([^<>]*)>/g, (_, inner: string) => (inner.includes(',') ? '' : `~${inner.trim()}~`));
  t = t.replace(/[<>{}:;]/g, '');
  t = t.replace(/\s+/g, ' ').trim();

  return t || 'any';
}
