import path from 'node:path';
import type { Hover, HoverParams } from 'vscode-languageserver';
import { AstNode, LangiumDocument, CstUtils, AstUtils, GrammarUtils } from 'langium';
import { AstNodeHoverProvider } from 'langium/lsp';
import { isAttribute, isBlock, isConst, isReferencePath, isTag, Module } from './generated/ast.js';
import { getDefaultHTMLDataProvider } from 'vscode-html-languageservice/lib/esm/htmlLanguageService.js';
// @ts-expect-error - this function is not exported in the types, for some reason
import { generateDocumentation } from 'vscode-html-languageservice/lib/esm/languageFacts/dataProvider.js';
import { loadTemplateData } from '@vue/language-service/lib/plugins/data.js';
import type { SnakeskinServices } from './snakeskin-module.js';
import type { TypeScriptServices } from './typescript-service.js';

export class HoverProvider extends AstNodeHoverProvider {
    protected vueData = loadTemplateData('en');
    protected ts: TypeScriptServices;

    constructor(services: SnakeskinServices) {
        super(services);
        this.ts = services.TypeScript.ts;
    };

    // by default, it tries to find the declaration, which we do not resolve yet, so we override the wrapper function
    override async getHoverContent(document: LangiumDocument<AstNode>, params: HoverParams): Promise<Hover | undefined> {
        const root = document.parseResult?.value?.$cstNode;
        const offset = document.textDocument.offsetAt(params.position);
        const node = CstUtils.findLeafNodeAtOffset(root!, offset);

        if (node) {
            const hoverContent = await this.getAstNodeHoverContent(node.astNode);
            if (hoverContent) {
                return hoverContent
            }
        }

        // If a node is not found or doesn't have customized hover content,
        // try to get the hover info from the TypeScript language service
        // TODO: this doesn't currently work well.
        // Seems like something is wrong with the trace regions
        const contents = this.ts.getHoverInfo(document.textDocument.uri, offset);
        if (contents) {
            // return { contents, range: node?.range };
        }

        return undefined;
    }

    // The actual logic of getting hover content for a specific node
    override async getAstNodeHoverContent(node: AstNode): Promise<Hover | undefined> {
        let range = node.$cstNode?.range;

        if (isTag(node)) {
            const name = ['.', undefined].includes(node.tagName) ? 'div' : node.tagName.toLowerCase();
            const vueTag = this.vueData.tags?.find(tag => tag.name.toLowerCase() === name);

            const tagNameCst = GrammarUtils.findNodeForProperty(node.$cstNode, 'tagName');
            if (tagNameCst) {
                range = tagNameCst.range;
            }

            if (vueTag) {
                return { contents: generateDocumentation(vueTag, undefined, true), range };
            }

            const htmlTag = getDefaultHTMLDataProvider().provideTags()
                .find(tag => tag.name.toLowerCase() === name);
            if (htmlTag) {
                return { contents: generateDocumentation(htmlTag, undefined, true), range };
            }
            if (name === '?') {
                return { contents: 'Placeholder tag. Will be removed during translation.', range };
            }
        } else if (isAttribute(node)) {
            const { key } = node;
            if (!key) return;
            const normalizedKey = key.replace(/^:/, '').replace(/^@/, '').toLowerCase();

            const keyCst = GrammarUtils.findNodeForProperty(node.$cstNode, 'key');
            if (keyCst) {
                range = keyCst.range;
            }

            const vueGlobalAttr = this.vueData.globalAttributes?.find(attr => attr.name.toLowerCase() === node.key);
            if (vueGlobalAttr) {
                return { contents: generateDocumentation(vueGlobalAttr, undefined, true), range };
            }

            const tagName = node.$container.tagName?.toLowerCase() ?? '';
            const vueTag = this.vueData.tags?.find(tag => tag.name.toLowerCase() === tagName);
            if (vueTag) {
                const attr = vueTag.attributes?.find(attr => normalizedKey === attr.name.toLowerCase());
                if (attr) {
                    return { contents: generateDocumentation(attr, undefined, true), range };
                }
            }

            const attrs = getDefaultHTMLDataProvider().provideAttributes(tagName);
            const attr = attrs.find(attr => normalizedKey === attr.name.toLowerCase());
            if (attr) {
                return { contents: generateDocumentation(attr, undefined, true), range };
            }
        } else if (isReferencePath(node)) {
            const uri = AstUtils.getDocument(node).textDocument.uri;
            if (node.name === '%fileName%') {
                return { contents: path.basename(uri, '.ss'), range };
            } else if (node.name === '%dirName%') {
                return { contents: path.basename(path.dirname(uri)), range };
            }
        } else if (isConst(node) || isBlock(node)) {
            const module = AstUtils.findRootNode(node) as Module;
            const langiumDoc = AstUtils.getDocument<Module>(module);
            const { uri } = langiumDoc.textDocument;
            const nameNode = GrammarUtils.findNodeForProperty(node.$cstNode, 'name');

            if (nameNode == undefined) {
                return;
            }

            const info = this.ts.getHoverInfo(uri, nameNode.offset);
            if (info) {
                return { contents: info, range };
            }
        }
        return undefined;
    }
}
