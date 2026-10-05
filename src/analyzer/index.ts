import { ArcModel } from '../model/types';
import { createProgram, detectLanguage, findSourceFiles } from '../parser/project';
import { analyzeClasses } from './classes';
import { analyzeDependencies } from './dependencies';
import { analyzeFunctions } from './functions';
import { collectRawEdges } from './imports';
import { analyzeLayers } from './layers';
import { toModuleId } from './moduleId';
import { analyzeRoutes } from './routes';

export function buildArcModel(rootDir: string): ArcModel {
  const files = findSourceFiles(rootDir);
  if (files.length === 0) {
    throw new Error(
      `No TypeScript/JavaScript source files found under "${rootDir}". Arc Code only analyzes TS/JS projects.`
    );
  }

  const program = createProgram(files);
  const rawEdges = collectRawEdges(program, files);
  const moduleIds = files.map((f) => toModuleId(rootDir, f));
  const internalModuleEdges = rawEdges
    .filter((e) => !e.external)
    .map((e) => ({ from: toModuleId(rootDir, e.from), to: toModuleId(rootDir, e.to) }));

  const layers = analyzeLayers(moduleIds, internalModuleEdges);
  const dependencies = analyzeDependencies(rawEdges, files, rootDir, layers);
  const routes = analyzeRoutes(program, files, rootDir);
  const classes = analyzeClasses(program, files, rootDir);
  const functions = analyzeFunctions(program, files, rootDir);

  return {
    meta: {
      language: detectLanguage(files),
      rootDir,
      analyzedFiles: files.map((f) => toModuleId(rootDir, f)).sort(),
    },
    layers,
    routes,
    classes,
    dependencies,
    functions,
  };
}
