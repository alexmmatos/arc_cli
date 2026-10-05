import { ClassEntry, ClassModel, InterfaceEntry, MethodEntry, PropertyEntry } from '../../model/types';
import { mermaidSafeType, slug } from '../mermaidUtils';

function visibilitySigil(v: 'public' | 'private' | 'protected'): string {
  if (v === 'private') return '-';
  if (v === 'protected') return '#';
  return '+';
}

/** Mermaid method member format: `<visibility><name>(<params>) <returnType>`. Param types are dropped — Mermaid can't safely hold arbitrary TS types in a parameter list. */
function methodMember(m: MethodEntry): string {
  const params = m.params.map((p) => p.name).join(', ');
  return `${visibilitySigil(m.visibility)}${m.name}(${params}) ${mermaidSafeType(m.returnType)}`;
}

/** Mermaid attribute member format: `<visibility><type> <name>` (no colon — Mermaid reserves `:`). */
function propertyMember(p: PropertyEntry): string {
  return `${visibilitySigil(p.visibility)}${mermaidSafeType(p.type)} ${p.name}`;
}

function allTypeTexts(entry: ClassEntry | InterfaceEntry): string[] {
  const texts = entry.properties.map((p) => p.type);
  for (const m of entry.methods) {
    texts.push(m.returnType, ...m.params.map((p) => p.type));
  }
  return texts;
}

/** Finds which other known classes/interfaces are mentioned (as whole words) across a set of raw type strings — covers arrays, generics, and unions without parsing the type properly. */
function referencedNames(texts: string[], knownNames: Set<string>, selfName: string, exclude: Set<string>): string[] {
  const found = new Set<string>();
  for (const name of knownNames) {
    if (name === selfName || exclude.has(name)) continue;
    const pattern = new RegExp(`\\b${name}\\b`);
    if (texts.some((text) => pattern.test(text))) found.add(name);
  }
  return [...found].sort();
}

/** All class/interface names directly reachable from `entry` (extends, implements, and uses), for building a one-class "neighborhood" mini-flow. */
export function directlyRelatedNames(entry: ClassEntry | InterfaceEntry, knownNames: Set<string>): string[] {
  const names = new Set<string>();
  if ('implements' in entry) {
    if (entry.extends) names.add(entry.extends);
    for (const impl of entry.implements) names.add(impl);
  } else {
    for (const ext of entry.extends) names.add(ext);
  }
  for (const target of referencedNames(allTypeTexts(entry), knownNames, entry.name, new Set())) {
    names.add(target);
  }
  names.delete(entry.name);
  return [...names];
}

export function renderClassesDiagram(classes: ClassModel): string {
  const classLines: string[] = [];

  for (const c of classes.classes) {
    classLines.push(`  class ${slug(c.name)} {`);
    for (const p of c.properties) classLines.push(`    ${propertyMember(p)}`);
    for (const m of c.methods) classLines.push(`    ${methodMember(m)}`);
    classLines.push('  }');
  }
  for (const i of classes.interfaces) {
    classLines.push(`  class ${slug(i.name)} {`);
    for (const p of i.properties) classLines.push(`    ${propertyMember(p)}`);
    for (const m of i.methods) classLines.push(`    ${methodMember(m)}`);
    classLines.push('  }');
  }

  const knownNames = new Set([...classes.classes.map((c) => c.name), ...classes.interfaces.map((i) => i.name)]);
  const relationLines: string[] = [];

  for (const c of classes.classes) {
    const exclude = new Set<string>();
    if (c.extends) {
      relationLines.push(`  ${slug(c.name)} --|> ${slug(c.extends)} : extends`);
      exclude.add(c.extends);
    }
    for (const impl of c.implements) {
      relationLines.push(`  ${slug(c.name)} ..|> ${slug(impl)} : implements`);
      exclude.add(impl);
    }
    for (const target of referencedNames(allTypeTexts(c), knownNames, c.name, exclude)) {
      relationLines.push(`  ${slug(c.name)} --> ${slug(target)} : uses`);
    }
  }
  for (const i of classes.interfaces) {
    const exclude = new Set<string>();
    for (const ext of i.extends) {
      relationLines.push(`  ${slug(i.name)} --|> ${slug(ext)} : extends`);
      exclude.add(ext);
    }
    for (const target of referencedNames(allTypeTexts(i), knownNames, i.name, exclude)) {
      relationLines.push(`  ${slug(i.name)} --> ${slug(target)} : uses`);
    }
  }

  return ['classDiagram', '  %% Classes / Structure', ...classLines, ...relationLines].join('\n') + '\n';
}
