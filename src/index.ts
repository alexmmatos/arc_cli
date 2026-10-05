import * as fs from 'fs';
import * as path from 'path';
import { buildArcModel } from './analyzer';
import { detectResources, scopedFilesForResource } from './analyzer/resources';
import { scopeClasses, scopeDependencies, scopeFunctions, scopeLayers, scopeRoutes } from './analyzer/scopeModel';
import { renderArchitectureDiagram } from './diagrams/architecture';
import { renderClassesDiagram } from './diagrams/classes';
import { renderDependenciesDiagram } from './diagrams/dependencies';
import { renderFunctionsDiagram } from './diagrams/functions';
import { renderRoutesDiagram } from './diagrams/routes';
import { renderSequenceDiagram } from './diagrams/sequence';
import { buildManifest } from './manifest';
import {
  buildClassMiniFlows,
  buildDependencyMiniFlows,
  buildFunctionMiniFlows,
  buildRouteMiniFlows,
  buildSequenceMiniFlows,
  MiniFlow,
} from './miniflows';
import { ArcModel, ClassModel, DependencyModel, FunctionModel, LayerModel, RouteModel } from './model/types';

export interface GenerateResult {
  outDir: string;
  model: ArcModel;
  files: string[];
  resources: string[];
  miniFlowCounts: Record<string, number>;
}

const DIAGRAM_NAMES = ['architecture.mmd', 'routes.mmd', 'classes.mmd', 'dependencies.mmd', 'functions.mmd', 'sequence.mmd'];

function writeDiagramSet(
  dir: string,
  parts: { layers: LayerModel; routes: RouteModel; classes: ClassModel; dependencies: DependencyModel; functions: FunctionModel }
): void {
  fs.mkdirSync(dir, { recursive: true });
  const write = (name: string, content: string) => fs.writeFileSync(path.join(dir, name), content);
  write('architecture.mmd', renderArchitectureDiagram(parts.layers));
  write('routes.mmd', renderRoutesDiagram(parts.routes));
  write('classes.mmd', renderClassesDiagram(parts.classes));
  write('dependencies.mmd', renderDependenciesDiagram(parts.dependencies));
  write('functions.mmd', renderFunctionsDiagram(parts.functions));
  write('sequence.mmd', renderSequenceDiagram(parts.routes));
}

function writeMiniFlows(dir: string, flows: MiniFlow[]): string[] {
  if (flows.length === 0) return [];
  fs.mkdirSync(dir, { recursive: true });
  for (const flow of flows) fs.writeFileSync(path.join(dir, flow.filename), flow.content);
  return flows.map((f) => f.filename);
}

/** Zips model entry keys (in the same order the corresponding mini-flow builder iterated) to "<dir>/<filename>" paths. */
function zipIndex(keys: string[], filenames: string[], dir: string): Record<string, string> {
  const entries: Record<string, string> = {};
  keys.forEach((key, i) => {
    entries[key] = `${dir}/${filenames[i]}`;
  });
  return entries;
}

export function generateInitialDiagrams(rootDir: string): GenerateResult {
  const model = buildArcModel(rootDir);
  const outDir = path.join(rootDir, '.arch');

  writeDiagramSet(outDir, model);

  const resources = detectResources(model.meta.analyzedFiles);
  for (const resource of resources) {
    const scopedFiles = scopedFilesForResource(resource.coreFiles, model.dependencies.edges);
    writeDiagramSet(path.join(outDir, 'domains', resource.name), {
      layers: scopeLayers(model.layers, scopedFiles),
      routes: scopeRoutes(model.routes, model.functions, resource.coreFiles),
      classes: scopeClasses(model.classes, scopedFiles),
      dependencies: scopeDependencies(model.dependencies, scopedFiles),
      functions: scopeFunctions(model.functions, scopedFiles),
    });
  }

  const miniFlows = {
    routes: writeMiniFlows(path.join(outDir, 'routes'), buildRouteMiniFlows(model.routes)),
    sequence: writeMiniFlows(path.join(outDir, 'sequence'), buildSequenceMiniFlows(model.routes)),
    functions: writeMiniFlows(path.join(outDir, 'functions'), buildFunctionMiniFlows(model.functions)),
    classes: writeMiniFlows(path.join(outDir, 'classes'), buildClassMiniFlows(model.classes)),
    dependencies: writeMiniFlows(path.join(outDir, 'dependencies'), buildDependencyMiniFlows(model.dependencies)),
  };

  const resourceNames = resources.map((r) => r.name);
  const index = {
    routes: zipIndex(model.routes.routes.map((r) => `${r.method} ${r.path}`), miniFlows.routes, 'routes'),
    sequence: zipIndex(model.routes.routes.map((r) => `${r.method} ${r.path}`), miniFlows.sequence, 'sequence'),
    functions: zipIndex(model.functions.functions.map((f) => f.name), miniFlows.functions, 'functions'),
    classes: zipIndex(
      [...model.classes.classes, ...model.classes.interfaces].map((c) => c.name),
      miniFlows.classes,
      'classes'
    ),
    dependencies: zipIndex(model.dependencies.modules, miniFlows.dependencies, 'dependencies'),
  };
  const manifest = buildManifest(model, resourceNames, miniFlows, index);
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const files = [
    ...DIAGRAM_NAMES,
    'manifest.json',
    ...resourceNames.flatMap((name) => DIAGRAM_NAMES.map((d) => `domains/${name}/${d}`)),
    ...Object.entries(miniFlows).flatMap(([dir, names]) => names.map((n) => `${dir}/${n}`)),
  ];

  const miniFlowCounts = Object.fromEntries(Object.entries(miniFlows).map(([dir, names]) => [dir, names.length]));

  return { outDir, model, files, resources: resourceNames, miniFlowCounts };
}

export * from './model/types';
