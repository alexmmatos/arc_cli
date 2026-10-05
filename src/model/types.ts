export type Language = 'typescript' | 'javascript';

export interface ArcModel {
  meta: {
    language: Language;
    rootDir: string;
    analyzedFiles: string[];
  };
  layers: LayerModel;
  routes: RouteModel;
  classes: ClassModel;
  dependencies: DependencyModel;
  functions: FunctionModel;
}

export interface LayerNode {
  id: string;
  label: string;
}

export interface LayerEdge {
  from: string;
  to: string;
}

export interface LayerModel {
  strategy: 'known-layers' | 'directory-graph';
  nodes: LayerNode[];
  edges: LayerEdge[];
}

export interface RouteEntry {
  method: string;
  path: string;
  handler: string;
  calls: string[];
  returns: string;
  file: string;
  line: number;
}

export interface RouteModel {
  routes: RouteEntry[];
}

export interface ParamEntry {
  name: string;
  type: string;
}

export interface MethodEntry {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  static: boolean;
  params: ParamEntry[];
  returnType: string;
}

export interface PropertyEntry {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  type: string;
}

export interface ClassEntry {
  name: string;
  file: string;
  extends?: string;
  implements: string[];
  methods: MethodEntry[];
  properties: PropertyEntry[];
}

export interface InterfaceEntry {
  name: string;
  file: string;
  extends: string[];
  methods: MethodEntry[];
  properties: PropertyEntry[];
}

export interface ClassModel {
  classes: ClassEntry[];
  interfaces: InterfaceEntry[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  external: boolean;
}

export interface FunctionEntry {
  name: string;
  file: string;
  line: number;
  params: ParamEntry[];
  returnType: string;
  complexity: string;
  calls: string[];
}

export interface FunctionModel {
  functions: FunctionEntry[];
}

export interface DependencyModel {
  modules: string[];
  externalPackages: string[];
  edges: DependencyEdge[];
  cycles: string[][];
  violations: DependencyEdge[];
}
