import { AstUtils, type AstNode } from 'langium';
import { AbstractSemanticTokenProvider, type SemanticTokenAcceptor } from 'langium/lsp';
import { SemanticTokenTypes, SemanticTokenModifiers } from 'vscode-languageserver-protocol';
import { isAttribute, isClass, isTag } from './generated/ast.js';
import { getDefaultHTMLDataProvider } from 'vscode-html-languageservice/lib/esm/htmlLanguageService.js';
import type { SnakeskinServices } from './snakeskin-module.js';
import { TypeScriptServices } from './typescript-service.js';

export class SemanticTokenProvider extends AbstractSemanticTokenProvider {
	protected ts: TypeScriptServices;

	constructor(services: SnakeskinServices) {
		super(services);
		this.ts = services.TypeScript.ts;
	}

	protected override highlightElement(node: AstNode, acceptor: SemanticTokenAcceptor): void | 'prune' | undefined {
		if (isTag(node)) {
			const isNativeHTML = getDefaultHTMLDataProvider().provideTags().some(tag => tag.name.toLowerCase() === node.tagName?.toLowerCase());
			acceptor({
				node,
				property: 'tagName',
				type: SemanticTokenTypes.function,
				modifier: isNativeHTML ? [SemanticTokenModifiers.defaultLibrary] : [],
			});
		} else if (isAttribute(node)) {
			acceptor({
				node,
				property: 'key',
				type: SemanticTokenTypes.property,
			});
			// Disabled temporarily until I figure out a way to reuse the JavaScript syntax highlighter
			// acceptor({
			// 	node,
			// 	property: 'value',
			// 	type: SemanticTokenTypes.string,
			// });
		} else if (isClass(node)) {
			acceptor({
				node,
				property: 'names',
				type: SemanticTokenTypes.modifier,
				modifier: node.nonSticky ? SemanticTokenModifiers.static : [],
			});
		} else {
			// Perhaps "highlightElement" is not even the appropriate function here?
			const { textDocument } = AstUtils.getDocument(node);
			const tokens = this.ts.getSemanticTokens(textDocument.uri, { start: node.$cstNode!.offset, length: node.$cstNode!.end });
			tokens;
			// tokens.forEach(acceptor);
		}
	}
}
