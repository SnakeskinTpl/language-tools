/**
 * IMPORTANT NOTE: This generator is NOT intended to generate correct/runnable code.
 * The only purpose is to mimic the semantics of Snakeskin as closely as possible to get diagnostics from TS.
 *
 * This tutorial is the main source followed for this module: https://www.typefox.io/blog/code-generation-for-langium-based-dsls-3/
 */

import { traceToNode, expandTracedToNode, joinTracedToNode, toStringAndTrace } from 'langium/generate';
import { type Generated, type TraceRegion } from 'langium/generate';
import type { Directive, Const, Parameter, Template, Module, Block } from "../generated/ast";

/**
 * Generates TypeScript code (with a source map) for a given Snakeskin module.
 */
export function generateTypeScript(module: Module): { text:string, trace: TraceRegion } | undefined {
  const directives = joinTracedToNode(module, 'directives')(module.directives, generateDirective);
  if (directives == undefined) {
    return undefined;
  }

  return toStringAndTrace(directives);
}

export type DirectiveGenerators = {
  [D in Directive as D["$type"]]: (directive: D) => Generated;
};

export const directiveGenerators: Partial<DirectiveGenerators> = {
  Template: generateTemplate,
  Const: generateConst,
  Block: generateBlock,
};

function generateDirective(directive: Directive): Generated {
  // The casting is required because TypeScript is not smart enough
  return directiveGenerators[directive.$type]?.(directive as never);
}

function generateTemplate(template: Template): Generated {
  const params = joinTracedToNode(template, 'params')(template.params, generateParam, { separator: ', ' });
  const body = joinTracedToNode(template, 'body')(template.body, generateDirective);

  // TODO: Although a template technically generates a JavaScript function in Snakeskin,
  // the generated code here should be class instead so they can inherit other templates
  // and blocks can be instance methods with overriding support, simplifying the IntelliSense.
  // Also, "self" (in blocks) should be simply aliased to "this"
  return expandTracedToNode(template)
    `export function ${traceToNode(template, 'name')(template.name)}(${params}) {`.appendNewLine()
      .indent(body?.contents)
      .append('}')
      .appendNewLine();
}

function generateParam(param: Parameter): Generated {
  const defaultValue = param.defaultValue ? traceToNode(param, 'defaultValue')(param.defaultValue) : '';
  const separator = defaultValue ? ' = ' : '';

  return expandTracedToNode(param)`${traceToNode(param, 'name')(param.name)}${separator}${defaultValue}`;
}

function generateConst(constNode: Const): Generated {
  const name = traceToNode(constNode, 'name')(constNode.name);
  const initialValue = traceToNode(constNode, 'initialValue')(constNode.initialValue);
  return expandTracedToNode(constNode)`const ${name} = ${initialValue};`.appendNewLine();
}

function generateBlock(block: Block): Generated {
  const params = joinTracedToNode(block, 'params')(block.params, generateParam, { separator: ', ' });
  const body = joinTracedToNode(block, 'body')(block.body, generateDirective);

  return expandTracedToNode(block)
    `function ${traceToNode(block, 'name')(block.name)}(${params}) {`
      .appendNewLine()
      .indent(body?.contents)
      .append('}')
      .appendNewLine();
}
