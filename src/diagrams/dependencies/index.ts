import { DependencyModel } from '../../model/types';
import { escapeFlowLabel, slug } from '../mermaidUtils';

export function renderDependenciesDiagram(deps: DependencyModel): string {
  const nodeLines: string[] = [];
  const nodeIds = new Set<string>();

  for (const m of deps.modules) {
    nodeIds.add(m);
    nodeLines.push(`  ${slug(m)}["${escapeFlowLabel(m)}"]`);
  }
  for (const pkg of deps.externalPackages) {
    const id = `pkg:${pkg}`;
    if (nodeIds.has(id)) continue;
    nodeIds.add(id);
    nodeLines.push(`  ${slug(id)}["${escapeFlowLabel(pkg)}"]`);
  }

  const cycleEdgeKeys = new Set<string>();
  for (const cycle of deps.cycles) {
    for (let i = 0; i < cycle.length - 1; i++) {
      cycleEdgeKeys.add(`${cycle[i]}=>${cycle[i + 1]}`);
    }
  }
  const violationKeys = new Set(deps.violations.map((v) => `${v.from}=>${v.to}`));

  const edgeLines = deps.edges.map((e) => {
    const toId = e.external ? `pkg:${e.to}` : e.to;
    const key = `${e.from}=>${e.to}`;
    const label = violationKeys.has(key) ? 'violation' : cycleEdgeKeys.has(key) ? 'cycle' : undefined;
    const arrow = label ? `-->|${label}|` : '-->';
    return `  ${slug(e.from)} ${arrow} ${slug(toId)}`;
  });

  return ['flowchart TD', '  %% Dependencies', ...nodeLines, ...edgeLines].join('\n') + '\n';
}
