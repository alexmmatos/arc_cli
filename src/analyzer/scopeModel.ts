import { ClassModel, DependencyModel, FunctionModel, LayerModel, RouteModel } from '../model/types';
import { containingDir, layerKeyForModuleId } from './layers';

export function scopeClasses(classes: ClassModel, scopedFiles: Set<string>): ClassModel {
  return {
    classes: classes.classes.filter((c) => scopedFiles.has(c.file)),
    interfaces: classes.interfaces.filter((i) => scopedFiles.has(i.file)),
  };
}

export function scopeFunctions(functions: FunctionModel, scopedFiles: Set<string>): FunctionModel {
  return { functions: functions.functions.filter((f) => scopedFiles.has(f.file)) };
}

export function scopeDependencies(deps: DependencyModel, scopedFiles: Set<string>): DependencyModel {
  const modules = deps.modules.filter((m) => scopedFiles.has(m));
  const edges = deps.edges.filter((e) => scopedFiles.has(e.from) && (e.external || scopedFiles.has(e.to)));
  const externalPackages = [...new Set(edges.filter((e) => e.external).map((e) => e.to))].sort();
  const cycles = deps.cycles.filter((cycle) => cycle.every((m) => scopedFiles.has(m)));
  const violations = deps.violations.filter((v) => scopedFiles.has(v.from) && scopedFiles.has(v.to));
  return { modules, externalPackages, edges, cycles, violations };
}

/** Keeps only the layer nodes that have at least one scoped file in them, and the edges between surviving nodes. */
export function scopeLayers(layers: LayerModel, scopedFiles: Set<string>): LayerModel {
  const presentKeys = new Set<string>();
  for (const file of scopedFiles) {
    const key = layers.strategy === 'known-layers' ? layerKeyForModuleId(file) : containingDir(file);
    if (key) presentKeys.add(key);
  }

  const nodes = layers.nodes.filter((n) => presentKeys.has(n.id));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = layers.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
  return { strategy: layers.strategy, nodes, edges };
}

/** A route "belongs" to a resource when its handler is implemented in one of the resource's own files — resolved via the (unscoped) FunctionModel, since routes are usually registered centrally (app.ts) rather than inside the resource's own files. */
export function scopeRoutes(routes: RouteModel, allFunctions: FunctionModel, coreFiles: string[]): RouteModel {
  const coreSet = new Set(coreFiles);
  const handlerFile = new Map(allFunctions.functions.map((f) => [f.name, f.file]));

  return {
    routes: routes.routes.filter((r) => {
      const file = handlerFile.get(r.handler);
      return file !== undefined && coreSet.has(file);
    }),
  };
}
