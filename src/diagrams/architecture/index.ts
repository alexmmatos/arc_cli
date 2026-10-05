import { LayerModel } from '../../model/types';
import { escapeFlowLabel, slug } from '../mermaidUtils';

export function renderArchitectureDiagram(layers: LayerModel): string {
  const lines = ['flowchart TD', '  %% Architecture / Layers'];

  for (const node of layers.nodes) {
    lines.push(`  ${slug(node.id)}["${escapeFlowLabel(node.label)}"]`);
  }
  for (const edge of layers.edges) {
    lines.push(`  ${slug(edge.from)} --> ${slug(edge.to)}`);
  }

  return lines.join('\n') + '\n';
}
