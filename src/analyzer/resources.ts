export interface ResourceGroup {
  name: string;
  coreFiles: string[];
}

const ROLE_SUFFIXES = ['Controller', 'Service', 'Repository', 'Repo', 'Dao', 'Model', 'Entity'];
const EXCLUDED_BASENAMES = new Set(['app', 'index', 'main', 'server', 'cli']);

function baseName(moduleId: string): string {
  return moduleId.split('/').pop() as string;
}

function resourceKeyForBase(base: string): string | null {
  if (EXCLUDED_BASENAMES.has(base.toLowerCase())) return null;
  for (const suffix of ROLE_SUFFIXES) {
    if (base.length > suffix.length && base.endsWith(suffix)) {
      return base.slice(0, -suffix.length).toLowerCase();
    }
  }
  return base.toLowerCase();
}

/**
 * Groups files into resources by shared filename prefix: customerController +
 * customerService + customerRepository + domain/customer all resolve to
 * "customer". Only resources with 2+ files represent a real cross-layer
 * flow worth its own sub-diagram; singletons (and infra files like app.ts)
 * are dropped.
 * ponytail: naming-convention heuristic — a project that doesn't prefix
 * files by resource (customerController.ts style) won't group here.
 */
export function detectResources(moduleIds: string[]): ResourceGroup[] {
  const buckets = new Map<string, string[]>();

  for (const id of moduleIds) {
    const key = resourceKeyForBase(baseName(id));
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)?.push(id);
  }

  return [...buckets.entries()]
    .filter(([, files]) => files.length >= 2)
    .map(([name, coreFiles]) => ({ name, coreFiles: coreFiles.sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Pulls in the direct (1-hop) internal dependency targets of a resource's
 * own files, so its sub-flow diagram shows the real neighbors it touches
 * (e.g. historyService.ts -> dealRepository.ts) instead of looking
 * dependency-free just because that file lives in another resource's
 * bucket. Deliberately not recursive — a 2nd hop would start pulling in
 * most of the project.
 */
export function scopedFilesForResource(
  coreFiles: string[],
  edges: { from: string; to: string; external: boolean }[]
): Set<string> {
  const core = new Set(coreFiles);
  const scoped = new Set(coreFiles);
  for (const edge of edges) {
    if (edge.external) continue;
    if (core.has(edge.from)) scoped.add(edge.to);
  }
  return scoped;
}
