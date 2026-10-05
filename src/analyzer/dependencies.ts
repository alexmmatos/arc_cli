import { DependencyEdge, DependencyModel, LayerModel } from '../model/types';
import { RawEdge } from './imports';
import { dependencyRank, layerKeyForModuleId } from './layers';
import { toModuleId } from './moduleId';

function findCycles(modules: string[], edges: DependencyEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const m of modules) adjacency.set(m, []);
  for (const e of edges) {
    if (e.external) continue;
    adjacency.get(e.from)?.push(e.to);
  }

  const cycles: string[][] = [];
  const seen = new Set<string>();
  const stack: string[] = [];

  function visit(node: string): void {
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      const idx = stack.indexOf(next);
      if (idx !== -1) {
        const cycle = stack.slice(idx).concat(next);
        const key = cycle.slice(0, -1).sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      } else {
        visit(next);
      }
    }
    stack.pop();
  }

  for (const m of modules) {
    stack.length = 0;
    visit(m);
  }

  return cycles;
}

function findLayerViolations(edges: DependencyEdge[], layers: LayerModel): DependencyEdge[] {
  if (layers.strategy !== 'known-layers') return [];

  const violations: DependencyEdge[] = [];

  for (const edge of edges) {
    if (edge.external) continue;
    const fromKey = layerKeyForModuleId(edge.from);
    const toKey = layerKeyForModuleId(edge.to);
    if (!fromKey || !toKey) continue;
    const fromRank = dependencyRank(fromKey);
    const toRank = dependencyRank(toKey);
    if (fromRank === undefined || toRank === undefined) continue;
    if (fromRank < toRank) violations.push(edge);
  }

  return violations;
}

export function analyzeDependencies(
  rawEdges: RawEdge[],
  files: string[],
  rootDir: string,
  layers: LayerModel
): DependencyModel {
  const modules = files.map((f) => toModuleId(rootDir, f)).sort();
  const edgeKeys = new Set<string>();
  const edges: DependencyEdge[] = [];
  const externalPackages = new Set<string>();

  for (const raw of rawEdges) {
    const fromId = toModuleId(rootDir, raw.from);
    const toId = raw.external ? (raw.externalPackage as string) : toModuleId(rootDir, raw.to);
    if (raw.external) externalPackages.add(toId);

    const key = `${fromId}=>${toId}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from: fromId, to: toId, external: raw.external });
  }

  edges.sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to));
  const cycles = findCycles(modules, edges);
  const violations = findLayerViolations(edges, layers);

  return {
    modules,
    externalPackages: [...externalPackages].sort(),
    edges,
    cycles,
    violations,
  };
}
