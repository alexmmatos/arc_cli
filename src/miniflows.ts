import { directlyRelatedNames, renderClassesDiagram } from './diagrams/classes';
import { renderDependenciesDiagram } from './diagrams/dependencies';
import { renderFunctionsDiagram } from './diagrams/functions';
import { renderRoutesDiagram } from './diagrams/routes';
import { renderSequenceDiagram } from './diagrams/sequence';
import { slug } from './diagrams/mermaidUtils';
import { ClassEntry, ClassModel, DependencyModel, FunctionModel, InterfaceEntry, RouteModel } from './model/types';

function isClassEntry(entry: ClassEntry | InterfaceEntry): entry is ClassEntry {
  return 'implements' in entry;
}

export interface MiniFlow {
  filename: string;
  content: string;
}

/** One file per route: its own request -> handler -> calls -> return flow, isolated from the rest of the API. */
export function buildRouteMiniFlows(routes: RouteModel): MiniFlow[] {
  return routes.routes.map((route, index) => ({
    filename: `${String(index).padStart(2, '0')}_${slug(`${route.method}_${route.path}`)}.mmd`,
    content: renderRoutesDiagram({ routes: [route] }),
  }));
}

/** One file per route: the same request -> handler -> calls -> return, as a sequence diagram instead of a flowchart. */
export function buildSequenceMiniFlows(routes: RouteModel): MiniFlow[] {
  return routes.routes.map((route, index) => ({
    filename: `${String(index).padStart(2, '0')}_${slug(`${route.method}_${route.path}`)}.mmd`,
    content: renderSequenceDiagram({ routes: [route] }),
  }));
}

/** One file per function: itself plus its direct neighbors (who it calls, and who calls it). */
export function buildFunctionMiniFlows(functions: FunctionModel): MiniFlow[] {
  const byName = new Map(functions.functions.map((f) => [f.name, f]));

  return functions.functions.map((fn) => {
    const neighborNames = new Set<string>();
    for (const callee of fn.calls) if (byName.has(callee)) neighborNames.add(callee);
    for (const other of functions.functions) {
      if (other.name !== fn.name && other.calls.includes(fn.name)) neighborNames.add(other.name);
    }

    const neighbors = [...neighborNames].map((name) => byName.get(name) as (typeof functions.functions)[number]);
    return {
      filename: `${slug(fn.name)}.mmd`,
      content: renderFunctionsDiagram({ functions: [fn, ...neighbors] }),
    };
  });
}

/** One file per class/interface: itself plus its direct neighbors (extends/implements/uses, in either direction). */
export function buildClassMiniFlows(classes: ClassModel): MiniFlow[] {
  const all = [...classes.classes, ...classes.interfaces];
  const byName = new Map(all.map((e) => [e.name, e]));
  const knownNames = new Set(all.map((e) => e.name));

  return all.map((entry) => {
    const neighborNames = new Set<string>(directlyRelatedNames(entry, knownNames));
    for (const other of all) {
      if (other.name === entry.name) continue;
      if (directlyRelatedNames(other, knownNames).includes(entry.name)) neighborNames.add(other.name);
    }

    const group = [entry, ...[...neighborNames].map((name) => byName.get(name) as ClassEntry | InterfaceEntry)];
    const scoped: ClassModel = {
      classes: group.filter(isClassEntry),
      interfaces: group.filter((e): e is InterfaceEntry => !isClassEntry(e)),
    };

    return { filename: `${slug(entry.name)}.mmd`, content: renderClassesDiagram(scoped) };
  });
}

/** One file per module: itself plus its direct import neighbors (what it imports, what imports it), and any cycle/violation touching it. */
export function buildDependencyMiniFlows(deps: DependencyModel): MiniFlow[] {
  return deps.modules.map((moduleId) => {
    const neighborEdges = deps.edges.filter((e) => e.from === moduleId || e.to === moduleId);
    const neighborModules = new Set<string>([moduleId]);
    const neighborPackages = new Set<string>();

    for (const edge of neighborEdges) {
      if (edge.external) neighborPackages.add(edge.to);
      else {
        neighborModules.add(edge.from);
        neighborModules.add(edge.to);
      }
    }

    const scoped: DependencyModel = {
      modules: [...neighborModules].sort(),
      externalPackages: [...neighborPackages].sort(),
      edges: neighborEdges,
      cycles: deps.cycles.filter((cycle) => cycle.includes(moduleId)),
      violations: deps.violations.filter((v) => v.from === moduleId || v.to === moduleId),
    };

    return { filename: `${slug(moduleId)}.mmd`, content: renderDependenciesDiagram(scoped) };
  });
}
