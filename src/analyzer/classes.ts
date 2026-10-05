import * as ts from 'typescript';
import { ClassEntry, ClassModel, InterfaceEntry, MethodEntry, PropertyEntry } from '../model/types';
import { toModuleId } from './moduleId';
import { extractParams, isStatic, typeToText, visibilityOf } from './tsHelpers';

function extractMethod(checker: ts.TypeChecker, member: ts.MethodDeclaration): MethodEntry {
  return {
    name: member.name.getText(),
    visibility: visibilityOf(member.modifiers),
    static: isStatic(member.modifiers),
    params: extractParams(checker, member.parameters),
    returnType: typeToText(checker, member, member.type),
  };
}

function extractProperty(checker: ts.TypeChecker, member: ts.PropertyDeclaration): PropertyEntry {
  return {
    name: member.name.getText(),
    visibility: visibilityOf(member.modifiers),
    type: typeToText(checker, member, member.type),
  };
}

function heritage(node: ts.ClassDeclaration | ts.InterfaceDeclaration): { extendsNames: string[]; implementsNames: string[] } {
  const extendsNames: string[] = [];
  const implementsNames: string[] = [];
  for (const clause of node.heritageClauses ?? []) {
    const names = clause.types.map((t) => t.expression.getText());
    if (clause.token === ts.SyntaxKind.ExtendsKeyword) extendsNames.push(...names);
    if (clause.token === ts.SyntaxKind.ImplementsKeyword) implementsNames.push(...names);
  }
  return { extendsNames, implementsNames };
}

export function analyzeClasses(program: ts.Program, files: string[], rootDir: string): ClassModel {
  const checker = program.getTypeChecker();
  const classes: ClassEntry[] = [];
  const interfaces: InterfaceEntry[] = [];

  for (const file of files) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;
    const fileId = toModuleId(rootDir, file);

    for (const statement of sourceFile.statements) {
      if (ts.isClassDeclaration(statement) && statement.name) {
        const { extendsNames, implementsNames } = heritage(statement);
        const methods: MethodEntry[] = [];
        const properties: PropertyEntry[] = [];

        for (const member of statement.members) {
          if (ts.isMethodDeclaration(member) && member.name) {
            methods.push(extractMethod(checker, member));
          } else if (ts.isPropertyDeclaration(member) && member.name) {
            properties.push(extractProperty(checker, member));
          } else if (ts.isConstructorDeclaration(member)) {
            methods.push({
              name: 'constructor',
              visibility: 'public',
              static: false,
              params: extractParams(checker, member.parameters),
              returnType: 'void',
            });
          }
        }

        classes.push({
          name: statement.name.text,
          file: fileId,
          extends: extendsNames[0],
          implements: implementsNames,
          methods,
          properties,
        });
      } else if (ts.isInterfaceDeclaration(statement)) {
        const { extendsNames } = heritage(statement);
        const methods: MethodEntry[] = [];
        const properties: PropertyEntry[] = [];

        for (const member of statement.members) {
          if (ts.isMethodSignature(member) && member.name) {
            methods.push({
              name: member.name.getText(),
              visibility: 'public',
              static: false,
              params: extractParams(checker, member.parameters),
              returnType: typeToText(checker, member, member.type),
            });
          } else if (ts.isPropertySignature(member) && member.name) {
            properties.push({
              name: member.name.getText(),
              visibility: 'public',
              type: typeToText(checker, member, member.type),
            });
          }
        }

        interfaces.push({
          name: statement.name.text,
          file: fileId,
          extends: extendsNames,
          methods,
          properties,
        });
      }
    }
  }

  return { classes, interfaces };
}
