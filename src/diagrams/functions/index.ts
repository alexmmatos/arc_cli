import { FunctionModel } from '../../model/types';
import { mermaidSafeType, slug } from '../mermaidUtils';

function shortName(qualifiedName: string): string {
  const parts = qualifiedName.split('.');
  return parts[parts.length - 1];
}

export function renderFunctionsDiagram(functions: FunctionModel): string {
  const knownNames = new Set(functions.functions.map((f) => f.name));

  const classLines: string[] = [];
  for (const fn of functions.functions) {
    const params = fn.params.map((p) => p.name).join(', ');
    const signature = `+${shortName(fn.name)}(${params}) ${mermaidSafeType(fn.returnType)} — ${fn.complexity}`;
    classLines.push(`  class ${slug(fn.name)} {`);
    classLines.push(`    ${signature}`);
    classLines.push('  }');
  }

  const relationLines: string[] = [];
  const seen = new Set<string>();
  for (const fn of functions.functions) {
    for (const target of fn.calls) {
      if (!knownNames.has(target) || target === fn.name) continue;
      const key = `${fn.name}=>${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      relationLines.push(`  ${slug(fn.name)} --> ${slug(target)} : calls`);
    }
  }

  return ['classDiagram', '  %% Functions / Complexity (heuristic Big-O)', ...classLines, ...relationLines].join('\n') + '\n';
}
