/**
 * IMPORTANT NOTE: This generator is NOT intended to generate correct/runnable code.
 * The only purpose is to mimic the semantics of Snakeskin as closely as possible to get diagnostics from TS.
 *
 * This tutorial is the main source followed for this module: https://www.typefox.io/blog/code-generation-for-langium-based-dsls-3/
 */

import { isJSDoc, type CommentProvider } from 'langium';
import { traceToNode, expandTracedToNode, joinTracedToNode, toStringAndTrace, expandToNode, NL, joinToNode, expandTracedToNodeIf } from 'langium/generate';
import type { Generated, TraceRegion } from 'langium/generate';
import type { Directive, Const, Parameter, Template, Module, Block, Import, Include, ReferencePath, Void, Tag, Call, If, ElseIf, Else, Unless, ElseUnless } from "../generated/ast";
import { isBlock, isConst } from "../generated/ast";
import type { SnakeskinServices } from '../snakeskin-module';

// TODO: move the context inside the class
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

type DirectiveGenerators = {
  [D in Directive as `generate${D["$type"]}`]: undefined | ((directive: D, ctx: GenerationContext) => Generated);
};

export class TypeScriptGenerationService implements Partial<DirectiveGenerators> {
  protected commentProvider: CommentProvider;

  constructor(readonly services: SnakeskinServices) {
    this.commentProvider = services.documentation.CommentProvider;
  }

  /**
   * Generates TypeScript code (with a source map) for a given Snakeskin module.
   */
  generateTypeScript(module: Module): { text: string, trace: TraceRegion } | undefined {
    const ctx = getDefaultContext();
    const directives = joinTracedToNode(module, 'directives')(module.directives, (dir) => this.generateDirective(dir, ctx));
    if (directives == undefined) {
      return undefined;
    }

    return toStringAndTrace(directives);
  }

  generateDirective = (directive: Directive, ctx: GenerationContext): Generated => {
    // @ts-expect-error - Not all functions are implemented yet
    const generated: Generated = this[`generate${directive.$type}`]?.(directive as never, ctx);
    const comment = this.commentProvider.getComment(directive);
    if (comment && isJSDoc(comment)) {
      return expandToNode`${comment}`
        .appendNewLine()
        .append(generated);
    }
    return generated;
  }

  generateTemplate = (template: Template, ctx: GenerationContext): Generated => {
    const params = joinTracedToNode(template, 'params')(template.params, this.generateParam, { separator: ', ' })!;

    let superClass: Generated;
    if (template.extends) {
      superClass = this.generateReferencePath(template.extends);
    }

    ctx = { ...ctx, insideTemplate: true };
    const isValidClassField = (dir: Directive) => [isBlock, isConst].some(f => f(dir));
    const classFieldDirectives = template.body.filter(dir => isValidClassField(dir));
    const otherDirectives = template.body.filter(dir => !isValidClassField(dir));

    const classBody = joinTracedToNode(template, 'body')(classFieldDirectives, (dir) => this.generateDirective(dir, ctx))!;
    const constructorBody = joinTracedToNode(template, 'body')(otherDirectives, (dir) => this.generateDirective(dir, ctx))!;


    if (!constructorBody.isEmpty() || !params.isEmpty()) {
      const classConstructor = expandToNode`
        constructor(${params}) {`.appendNewLine()
        .indent(['const self = this;', NL, constructorBody])
        .append('}')
        .appendNewLine();

      classBody.contents.unshift(classConstructor);
    }

    // Add external blocks (if any)
    const external = ctx.externalBlocks[template.name] ?? [];
    classBody.appendIf(
      external.length > 0,
      joinToNode(external, block => this.generateBlock(block, ctx))
    );

    // Flatten nested blocks (if any)
    classBody.appendIf(
      ctx.nestedBlocks.length > 0,
      joinToNode(ctx.nestedBlocks, block => this.generateBlock(block, ctx))
    );

    // Reset the modified context
    ctx.nestedBlocks = [];
    ctx.externalBlocks[template.name] = [];

    return expandTracedToNode(template)
      `export class ${traceToNode(template, 'name')(template.name)} ${superClass != undefined ? 'extends ' : ''}${superClass} {`.appendNewLine()
      .indent([classBody])
      .append('}')
      .appendNewLine();
  }

  generateParam = (param: Parameter): Generated => {
    const defaultValue = param.defaultValue ? traceToNode(param, 'defaultValue')(param.defaultValue) : '';
    const separator = defaultValue ? ' = ' : '';

    return expandTracedToNode(param)`${traceToNode(param, 'name')(param.name)}${separator}${defaultValue}`;
  }

  generateConst = (constNode: Const, ctx: GenerationContext): Generated => {
    const name = traceToNode(constNode, 'name')(constNode.name);
    const initialValue = traceToNode(constNode, 'initialValue')(constNode.initialValue);
    if (ctx.insideTemplate && !ctx.insideBlock) {
      return expandTracedToNode(constNode)`readonly ${name} = ${initialValue};`.appendNewLine();
    } else {
      return expandTracedToNode(constNode)`const ${name} = ${initialValue};`.appendNewLine();
    }
  }

  generateBlock = (block: Block, ctx: GenerationContext): Generated => {
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

    const params = joinTracedToNode(block, 'params')(block.params, this.generateParam, { separator: ', ' })!;
    ctx = { ...ctx, insideBlock: true };
    const body = joinTracedToNode(block, 'body')(block.body, (dir) => this.generateDirective(dir, ctx))!;

    const preamble = expandTracedToNodeIf(!body.isEmpty() && ctx.insideTemplate, block)`
      const self = this;`?.appendNewLine();

    return expandTracedToNode(block)
      `${ctx.insideTemplate ? '' : 'function '}${traceToNode(block, 'name')(block.name)}(${params}): string {`
      .appendNewLine()
      .indent([preamble, body])
      .append('}')
      .appendNewLine();
  }

  generateImport = (importNode: Import): Generated => {
    const name = traceToNode(importNode, 'name')(importNode.name);
    const path = traceToNode(importNode, 'path')(importNode.path);

    return expandTracedToNode(importNode)
      `import ${name} from "${path}";`.appendNewLine();
  }

  protected normalizeId(id: string): string {
    return id.replace(/[^\w]/g, '_');
  }

  generateInclude = (include: Include): Generated => {
    if (include.renderAs !== 'placeholder') {
      // Don't care about non-named imports for now (I think)
      return;
    }

    // For now, I (unjustifiably) assume that all imported files have "- namespace [%fileName%]"
    // This makes it easier to map it to a "namespace import".

    const namespace = this.normalizeId(include.path.replace('/index.ss', '').replace('.ss', '').split('/').pop()!);

    const name = traceToNode(include, 'renderAs')(namespace);
    // TODO: resolve the absolute path to the ".ss.ts" virtual file
    const path = traceToNode(include, 'path')(include.path);

    return expandTracedToNode(include)
      `import * as ${name} from "${path}";`.appendNewLine();
  }

  generateReferencePath = (path: ReferencePath): Generated => {
    const name = this.normalizeId(path.name);

    const generated = expandTracedToNode(path)`${name}`;
    if (path.next) {
      const next = this.generateReferencePath(path.next);
      generated
        .append('.')
        .appendTraced(path, 'next')(next);
    }
    return generated;
  }

  generateCall = (call: Call, ctx: GenerationContext): Generated => {
    const body = joinTracedToNode(call, 'body')(call.body, (dir) => this.generateDirective(dir, ctx))
    return expandTracedToNode(call, 'value')`${call.value};`
      .appendNewLine()
      .appendTracedIf(!body?.isEmpty(), call, 'body')(body)
      .appendNewLineIfNotEmpty();
  }

  generateVoid = (voidNode: Void): Generated => {
    return expandTracedToNode(voidNode, 'content')`void (${voidNode.content})`.appendNewLine();
  }

  generateTag = (tag: Tag, ctx: GenerationContext): Generated => {
    // TODO: implement actual generation for tags
    // Check if it a built-in HTML component and use `document.createElement`
    // If it is Vue, idk what to do. Maybe JSX?
    // If neither, find it in imports and use `new Component()`, followed by setting attributes manually

    // For now, just skip to the body
    return joinTracedToNode(tag, 'body')(tag.body, (dir) => this.generateDirective(dir, ctx));
  }

  generateIf = (ifNode: If, ctx: GenerationContext): Generated => {
    const condition = expandTracedToNode(ifNode, 'condition')`${ifNode.condition}`;
    const body = joinTracedToNode(ifNode, 'body')(ifNode.body, (dir) => this.generateDirective(dir, ctx));

    return expandTracedToNode(ifNode)`if (${condition}) {`.appendNewLine()
      .indent([body])
      .append('}')
      .appendNewLine();
  }

  generateElseIf = (elseIf: ElseIf, ctx: GenerationContext): Generated => {
    const condition = expandTracedToNode(elseIf, 'condition')`${elseIf.condition}`;
    const body = joinTracedToNode(elseIf, 'body')(elseIf.body, (dir) => this.generateDirective(dir, ctx));

    return expandTracedToNode(elseIf)`else if (${condition}) {`.appendNewLine()
      .indent([body])
      .append('}')
      .appendNewLine();
  }

  generateElse = (elseNode: Else, ctx: GenerationContext): Generated => {
    const body = joinTracedToNode(elseNode, 'body')(elseNode.body, (dir) => this.generateDirective(dir, ctx));

    return expandTracedToNode(elseNode)`else {`.appendNewLine()
      .indent([body])
      .append('}')
      .appendNewLine();
  }

  generateUnless = (unless: Unless, ctx: GenerationContext): Generated => {
    const condition = expandTracedToNode(unless, 'condition')`${unless.condition}`;
    const body = joinTracedToNode(unless, 'body')(unless.body, (dir) => this.generateDirective(dir, ctx));

    return expandTracedToNode(unless)`if (!(${condition})) {`.appendNewLine()
      .indent([body])
      .append('}')
      .appendNewLine();
  }

  generateElseUnless = (elseUnless: ElseUnless, ctx: GenerationContext): Generated => {
    const condition = expandTracedToNode(elseUnless, 'condition')`${elseUnless.condition}`;
    const body = joinTracedToNode(elseUnless, 'body')(elseUnless.body, (dir) => this.generateDirective(dir, ctx));

    return expandTracedToNode(elseUnless)`else if (!(${condition})) {`.appendNewLine()
      .indent([body])
      .append('}')
      .appendNewLine();
  }
}
