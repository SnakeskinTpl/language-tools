import path from 'node:path';
import type { Hover, HoverParams } from 'vscode-languageserver';
import { AstNode, LangiumDocument, MaybePromise, CstUtils } from 'langium';
import { AstNodeHoverProvider } from 'langium/lsp';
import { isAttribute, isReferencePath, isTag } from './generated/ast.js';
import { getDefaultHTMLDataProvider } from 'vscode-html-languageservice/lib/esm/htmlLanguageService.js';
// @ts-expect-error - this function is not exported in the types, for some reason
import { generateDocumentation } from 'vscode-html-languageservice/lib/esm/languageFacts/dataProvider.js';
import { loadTemplateData } from '@vue/language-service/lib/plugins/data.js';

export class HoverProvider extends AstNodeHoverProvider {
    protected vueData = loadTemplateData('en')

    // by default, it tries to find the declaration, which we do not resolve yet, so we override the wrapper function
    override getHoverContent(document: LangiumDocument<AstNode>, params: HoverParams): MaybePromise<Hover | undefined> {
        const root = document.parseResult?.value?.$cstNode;
        const offset = document.textDocument.offsetAt(params.position);
        const node = CstUtils.findDeclarationNodeAtOffset(root!, offset);
        if (node) {
            return this.getAstNodeHoverContent(node.astNode);
        }
        return undefined;
    }

    // The actual logic of getting hover content for a specific node
    async getAstNodeHoverContent(node: AstNode): Promise<Hover|undefined> {
        const range = node.$cstNode?.range;

        if (isTag(node)) {
            const name = ['.', undefined].includes(node.tagName) ? 'div' : node.tagName.toLowerCase();
            const vueTag = this.vueData.tags?.find(tag => tag.name.toLowerCase() === name);
            if (vueTag) {
                return {contents: generateDocumentation(vueTag, undefined, true), range};
            }

            const htmlTag = getDefaultHTMLDataProvider().provideTags()
                .find(tag => tag.name.toLowerCase() === name);
            if (htmlTag) {
                return {contents: generateDocumentation(htmlTag, undefined, true), range};
            }
            if (name === '?') {
                return {contents: 'Placeholder tag. Will be removed during translation.', range};
            }
        } else if (isAttribute(node)) {
            const {key} = node;
            if (!key) return;
            const normalizedKey = key.replace(/^:/, '').replace(/^@/, '').toLowerCase();

            const vueGlobalAttr = this.vueData.globalAttributes?.find(attr => attr.name.toLowerCase() === node.key);
            if (vueGlobalAttr) {
                return {contents: generateDocumentation(vueGlobalAttr, undefined, true), range};
            }

            const tagName = node.$container.tagName?.toLowerCase() ?? '';
            const vueTag = this.vueData.tags?.find(tag => tag.name.toLowerCase() === tagName);
            if (vueTag) {
                const attr = vueTag.attributes?.find(attr => normalizedKey === attr.name.toLowerCase());
                if (attr) {
                    return {contents: generateDocumentation(attr, undefined, true), range};
                }
            }

            const attrs = getDefaultHTMLDataProvider().provideAttributes(tagName);
            const attr = attrs.find(attr => normalizedKey === attr.name.toLowerCase());
            if (attr) {
                return {contents: generateDocumentation(attr, undefined, true), range};
            }
        } else if (isReferencePath(node)) {
            const uri = node.$cstNode?.root.astNode.$document?.textDocument.uri;
            if (uri == undefined) return;
            if (node.name === '%fileName%') {
                return {contents: path.basename(uri, '.ss'), range};
            } else if (node.name === '%dirName%') {
                return {contents: path.basename(path.dirname(uri)), range};
            }
        }
        return undefined;
    }
}
