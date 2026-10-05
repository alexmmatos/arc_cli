import { LayerModel } from '../model/types';

const CANONICAL_ORDER = [
  'controller',
  'route',
  'middleware',
  'service',
  'domain',
  'model',
  'entity',
  'repository',
  'dao',
  'database',
  'db',
];

/**
 * Innermost-to-outermost rank used only for flagging dependency-direction
 * violations (never for the architecture diagram's display order above).
 * Domain/model/entity are the most foundational: everything may depend on
 * them, but they must not depend on anything else. Repository sits between
 * domain and service for this purpose because both import domain types, but
 * only service (and controller) should import repository.
 */
const DEPENDENCY_RANK = [
  'domain',
  'model',
  'entity',
  'repository',
  'dao',
  'database',
  'db',
  'service',
  'middleware',
  'route',
  'controller',
];

function normalize(segment: string): string {
  const lower = segment.toLowerCase();
  if (lower.endsWith('ies')) return lower.slice(0, -3) + 'y';
  if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function dirSegments(moduleId: string): string[] {
  return moduleId.split('/').slice(0, -1);
}

function matchCanonicalSegment(segments: string[]): string | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (CANONICAL_ORDER.includes(normalize(segments[i]))) return segments[i];
  }
  return null;
}

export function layerKeyForModuleId(moduleId: string): string | null {
  const segment = matchCanonicalSegment(dirSegments(moduleId));
  return segment ? normalize(segment) : null;
}

/** Rank of a layer key for dependency-direction checks, or undefined if unrecognized. See DEPENDENCY_RANK. */
export function dependencyRank(layerKey: string): number | undefined {
  const idx = DEPENDENCY_RANK.indexOf(layerKey);
  return idx === -1 ? undefined : idx;
}

export function containingDir(moduleId: string): string {
  const segments = dirSegments(moduleId);
  return segments.length > 0 ? segments.join('/') : '.';
}

export function analyzeLayers(moduleIds: string[], moduleEdges: { from: string; to: string }[]): LayerModel {
  const keyToLabel = new Map<string, string>();

  for (const id of moduleIds) {
    const segment = matchCanonicalSegment(dirSegments(id));
    if (segment) keyToLabel.set(normalize(segment), capitalize(segment));
  }

  if (keyToLabel.size >= 2) {
    const sortedKeys = [...keyToLabel.keys()].sort(
      (a, b) => CANONICAL_ORDER.indexOf(a) - CANONICAL_ORDER.indexOf(b)
    );
    const nodes = sortedKeys.map((key) => ({ id: key, label: keyToLabel.get(key) as string }));
    const edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ from: nodes[i].id, to: nodes[i + 1].id });
    }
    return { strategy: 'known-layers', nodes, edges };
  }

  return directoryGraph(moduleIds, moduleEdges);
}

function directoryGraph(moduleIds: string[], moduleEdges: { from: string; to: string }[]): LayerModel {
  const dirs = [...new Set(moduleIds.map(containingDir))].sort();
  const nodes = dirs.map((d) => ({ id: d, label: d }));

  const moduleToDir = new Map(moduleIds.map((id) => [id, containingDir(id)]));
  const edgeKeys = new Set<string>();
  const edges: { from: string; to: string }[] = [];

  for (const e of moduleEdges) {
    const fromDir = moduleToDir.get(e.from);
    const toDir = moduleToDir.get(e.to);
    if (!fromDir || !toDir || fromDir === toDir) continue;
    const key = `${fromDir}=>${toDir}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    edges.push({ from: fromDir, to: toDir });
  }

  return { strategy: 'directory-graph', nodes, edges };
}
