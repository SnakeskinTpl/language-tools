/**
 * IMPORTANT NOTE: This generator is NOT intended to generate correct/runnable code.
 * The only purpose is to mimic the semantics of Snakeskin as closely as possible to get diagnostics from TS.
 *
 * This tutorial is the main source followed for this module: https://www.typefox.io/blog/code-generation-for-langium-based-dsls-3/
 */

import { traceToNode, expandTracedToNode, joinTracedToNode, toStringAndTrace, expandToNode, NL, joinToNode, expandTracedToNodeIf } from 'langium/generate';
import { type Generated, type TraceRegion } from 'langium/generate';
import { type Directive, type Const, type Parameter, type Template, type Module, type Block, type ReferencePath, isBlock, isConst } from "../generated/ast";

type GenerationContext = {
  insideTemplate: boolean;
  insideBlock: boolean;
  /**
   * Holds blocks nested inside other blocks since they need to be flattened in the generated class.
   * Their code generation will be delegated to the end of the template generation.
   */
  nestedBlocks: Block[];
  /**
   * Holds any blocks declared outside a template but with "- block index->div()" syntax,
   * since they can only generated while actually generating the template code.
   * Their code generation will be delegated until the template is found.
   * The record key is the template name.
   */
  externalBlocks: Record<string, Block[]>;
}
function getDefaultContext(): GenerationContext {
  return {
    insideTemplate: false,
    insideBlock: false,
    nestedBlocks: [],
    externalBlocks: {},
  };
}

/**
 * Generates TypeScript code (with a source map) for a given Snakeskin module.
 */
export function generateTypeScript(module: Module): { text:string, trace: TraceRegion } | undefined {
  const ctx = getDefaultContext();
  const directives = joinTracedToNode(module, 'directives')(module.directives, (dir) => generateDirective(dir, ctx));
  if (directives == undefined) {
    return undefined;
  }

  return toStringAndTrace(directives);
}

export type DirectiveGenerators = {
  [D in Directive as D["$type"]]: (directive: D, ctx: GenerationContext) => Generated;
};

export const directiveGenerators: Partial<DirectiveGenerators> = {
  Template: generateTemplate,
  Const: generateConst,
  Block: generateBlock,
};

function generateDirective(directive: Directive, ctx: GenerationContext): Generated {
  // The casting is required because TypeScript is not smart enough
  return directiveGenerators[directive.$type]?.(directive as never, ctx);
}

function generateTemplate(template: Template, ctx: GenerationContext): Generated {
  const params = joinTracedToNode(template, 'params')(template.params, generateParam, { separator: ', ' });

  let superClass: Generated;
  if (template.extends) {
    superClass = generateReferencePath(template.extends);
  }

  ctx = { ...ctx, insideTemplate: true };
  const isValidClassField = (dir: Directive) => [isBlock, isConst].some(f => f(dir));
  const classFieldDirectives = template.body.filter(dir => isValidClassField(dir));
  const otherDirectives = template.body.filter(dir => !isValidClassField(dir));

  const classBody = joinTracedToNode(template, 'body')(classFieldDirectives, (dir) => generateDirective(dir, ctx))!;
  const constructorBody = joinTracedToNode(template, 'body')(otherDirectives, (dir) => generateDirective(dir, ctx))!;


  if (!constructorBody.isEmpty()) {
    const classConstructor = expandToNode`
      constructor() {`.appendNewLine()
        .indent(['const self = this;', NL, constructorBody])
        .append('}')
        .appendNewLine();

    classBody.contents.unshift(classConstructor);
  }

  // Add external blocks (if any)
  const external = ctx.externalBlocks[template.name] ?? [];
  classBody.appendIf(
    external.length > 0,
    joinToNode(external, block => generateBlock(block, ctx))
  );

  // Flatten nested blocks (if any)
  classBody.appendIf(
    ctx.nestedBlocks.length > 0,
    joinToNode(ctx.nestedBlocks, block => generateBlock(block, ctx))
  );

  // Reset the modified context
  ctx.nestedBlocks = [];
  ctx.externalBlocks[template.name] = [];

  return expandTracedToNode(template)
    `export class ${traceToNode(template, 'name')(template.name)}(${params}) ${superClass != undefined ? 'extends ' : ''}${superClass} {`.appendNewLine()
      .indent([classBody])
      .append('}')
      .appendNewLine();
}

function generateParam(param: Parameter): Generated {
  const defaultValue = param.defaultValue ? traceToNode(param, 'defaultValue')(param.defaultValue) : '';
  const separator = defaultValue ? ' = ' : '';

  return expandTracedToNode(param)`${traceToNode(param, 'name')(param.name)}${separator}${defaultValue}`;
}

function generateConst(constNode: Const, ctx: GenerationContext): Generated {
  const name = traceToNode(constNode, 'name')(constNode.name);
  const initialValue = traceToNode(constNode, 'initialValue')(constNode.initialValue);
  if (ctx.insideTemplate && !ctx.insideBlock) {
    return expandTracedToNode(constNode)`readonly ${name} = ${initialValue};`.appendNewLine();
  } else {
    return expandTracedToNode(constNode)`const ${name} = ${initialValue};`.appendNewLine();
  }
}

function generateBlock(block: Block, ctx: GenerationContext): Generated {
  if (block.container && !ctx.insideTemplate) {
    // Found an external block. Delegate its generation to when we find its template.
    ctx.externalBlocks[block.container.$refText] ??= [];
    ctx.externalBlocks[block.container.$refText].push(block);
    return;
  }
  if (ctx.insideBlock) {
    // Found a nested block. Delegate its generation to when we're back to the template root.
    ctx.nestedBlocks.push(block);
    return;
  }

  const params = joinTracedToNode(block, 'params')(block.params, generateParam, { separator: ', ' })!;
  ctx = { ...ctx, insideBlock: true };
  const body = joinTracedToNode(block, 'body')(block.body, (dir) => generateDirective(dir, ctx))!;

  const preamble = expandTracedToNodeIf(!body.isEmpty() && ctx.insideTemplate, block)`
    const self = this;`?.appendNewLine();

  return expandTracedToNode(block)
    `${ctx.insideTemplate ? '' : 'function '}${traceToNode(block, 'name')(block.name)}(${params}) {`
      .appendNewLine()
      .indent([preamble, body])
      .append('}')
      .appendNewLine();
}

const normalizeId = (id: string): string => id.replace(/[^\w]/g, '_');


function generateReferencePath(path: ReferencePath): Generated {
  const name = normalizeId(path.name);

  const generated = expandTracedToNode(path)`${name}`;
  if (path.next) {
    const next = generateReferencePath(path.next);
    generated
      .append('.')
      .appendTraced(path, 'next')(next);
  }
  return generated;
}
