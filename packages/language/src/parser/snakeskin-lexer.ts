import type { IMultiModeLexerDefinition, TokenType, TokenPattern } from 'chevrotain';
import type { Grammar, GrammarAST, LexerResult, TokenBuilderOptions } from 'langium';
import {
	isTokenTypeArray,
	RegExpUtils,
	isIMultiModeLexerDefinition,
	IndentationAwareTokenBuilder,
	IndentationAwareLexer,
	LexingMode,
} from 'langium';
import { consumeLiteral } from './js-literal.js';
import { SnakeskinTokenNames, SnakeskinTerminalNames, SnakeskinKeywordNames } from '../generated/ast.js';

export class SnakeskinTokenBuilder extends IndentationAwareTokenBuilder<SnakeskinTerminalNames, SnakeskinKeywordNames> {
	/** Keywords that are allowed at the beginning of a line, otherwise they would be detected as text */
	readonly startOfLineWhitelist = new Set<SnakeskinTokenNames>(['-', '+=', '<', '*', '?']);

	/** Keywords that must be preceded by '-'. This is to avoid them being detected as keywords in other places */
	readonly dashOnlyKeywords = new Set<SnakeskinTokenNames>([
		'namespace', 'block', 'return', 'eval', 'head', 'with', 'else', 'switch',
		'for', 'break', 'continue', 'forEach', 'forIn', 'try', 'throw', 'catch', 'finally', 'doctype',
		'include', 'import', 'target', 'super',
	]);

	/** Keywords that can come after '-' or '- else' */
	readonly dashOrElseKeywords = new Set<SnakeskinTokenNames>(['if', 'unless']);

	/** Keywords that can only appear after 'as' (used in includes) or '-' */
	readonly dashOrAsKeywords = new Set<SnakeskinTokenNames>(['placeholder', 'interface']);

	constructor() {
		super({
			ignoreIndentationDelimiters: [
				['AMPERSAND_NL', 'DOT_NL'],
			],
		});
	}

	override buildTokens(grammar: Grammar, options?: TokenBuilderOptions | undefined): IMultiModeLexerDefinition {
		const tokens = super.buildTokens(grammar, options);

		let regularTokens: TokenType[];
		let ignoreIndentTokens: TokenType[];
		let defaultMode: string = LexingMode.REGULAR;

		if (isTokenTypeArray(tokens)) {
			regularTokens = ignoreIndentTokens = tokens;
		} else if (isIMultiModeLexerDefinition(tokens)) {
			regularTokens = tokens.modes[LexingMode.REGULAR];
			ignoreIndentTokens = tokens.modes[LexingMode.IGNORE_INDENTATION];
			defaultMode = tokens.defaultMode;
		} else {
			regularTokens = ignoreIndentTokens = Object.values(tokens);
		}

		return {
			modes: {
				[LexingMode.REGULAR]: regularTokens.filter(token => token.name !== 'ATTR_VAL_ML'),
				[LexingMode.IGNORE_INDENTATION]: ignoreIndentTokens.filter(token => !['ATTR_VAL_SL', 'TEXT'].includes(token.name)),
			},
			defaultMode,
		};
	}

	protected override buildKeywordPattern(keywordNode: GrammarAST.Keyword, caseInsensitive: boolean): TokenPattern {
		const { value } = keywordNode;
		const keyword = value as SnakeskinTokenNames;
		// To avoid conflicts with TEXT/ID, the keyword tokens can only appear after '\n- '
		if (this.startOfLineWhitelist.has(keyword)) {
			const escaped = RegExpUtils.escapeRegExp(keyword);
			const regex = new RegExp(`(?<=^\\s*)${escaped}(?=\\s)`, 'my');
			return (text, offset, tokens) => {
				// special case for '?' because it can be the tag name
				// Temporary until '?' is allowed in a tag name
				if (keyword === '?' && text[offset] === keyword && tokens.at(-1)?.tokenType.name === '<') {
					return [keyword];
				}
				regex.lastIndex = offset;
				return regex.exec(text);
			}
		}
		if (this.dashOnlyKeywords.has(keyword)) {
			return (text, offset, tokens) => {
				if (tokens.at(-1)?.tokenType.name !== '-') {
					return null;
				}
				const match = text.substring(offset, offset + keyword.length);
				return match === keyword ? [match] : null;
			}
		}
		if (this.dashOrElseKeywords.has(keyword)) {
			return (text, offset, tokens) => {
				// either '- <keyword>' or '- else <keyword>'
				const prevToken = tokens.at(-1)?.tokenType.name ?? '';
				if (!['-', 'else'].includes(prevToken)) {
					return null;
				}
				const match = text.substring(offset, offset + keyword.length);
				return match === keyword ? [match] : null;
			}
		}
		if (this.dashOrAsKeywords.has(keyword)) {
			return (text, offset, tokens) => {
				// either '- <keyword>' or 'as <keyword>'
				const prevToken = tokens.at(-1)?.tokenType.name ?? '';
				if (!['-', 'AS'].includes(prevToken)) {
					return null;
				}
				const match = text.substring(offset, offset + keyword.length);
				return match === keyword ? [match] : null;
			}
		}
		if (keyword === 'template') {
			// can appear only after dash or 'async'
			return (text, offset, tokens) => {
				const prevToken = tokens.at(-1)?.tokenType.name ?? '';
				if (!['-', 'ASYNC'].includes(prevToken)) {
					return null;
				}
				const match = text.substring(offset, offset + keyword.length);
				return match === keyword ? [match] : null;
			}
		}
		return super.buildKeywordPattern(keywordNode, caseInsensitive);
	}

	protected override buildTerminalToken(terminal: GrammarAST.TerminalRule): TokenType {
		const tokenType = super.buildTerminalToken(terminal);
		if (tokenType.name === 'INTERPOLATION') {
			const startRegex = /\$\{/y;
			tokenType.PATTERN = (text, offset, tokens, groups) => {
				startRegex.lastIndex = offset;
				const match = startRegex.exec(text);
				if (match === null) {
					return null;
				}
				// balance braces until reaching the closing one
				// technically, this is also not enough since we can have braces inside strings, but 🤷‍♂️
				let depth = 1;
				let i = startRegex.lastIndex;
				while (depth > 0 && i < text.length) {
					if (text[i] === '{') {
						depth++;
					} else if (text[i] === '}') {
						depth--;
					}
					i++;
				}
				return [text.substring(offset, i)];
			}
		} else if (tokenType.name === 'PARAM_DEFAULT_VALUE') {
			tokenType.PATTERN = (text, offset, tokens, groups) => {
				if (tokens.length < 3) return null;
				const [{tokenType: {name: parenOrComma}}, {tokenType: {name: id}}, {tokenType: {name: eq}}] = tokens.slice(-3);
				if (eq !== '=' || id !== 'ID' || !['L_PAREN', 'COMMA', 'AT'].includes(parenOrComma)) {
					return null;
				}

				const nextText = text.substring(offset);
				const [restOfLine] = nextText.match(/.*/)!;
				const match = consumeLiteral(restOfLine);

				if (match.length) {
					return [match];
				}
				return null;
			}
		} else if (tokenType.name === 'EXPR_TILL_EOL') {
			tokenType.PATTERN = (text, offset, tokens, groups) => {
				// The " |" part is to support single line attribute values as well
				const originalRegex = /(?<=\s(return|\+?=|if|switch|for|throw|unless|- target|\?|>|<!)\s).+?(?=$|\s+\|\s+)/my;
				originalRegex.lastIndex = offset;
				const singleLineMatch =  originalRegex.exec(text);
				if (singleLineMatch?.[0].endsWith('&')) {
					// The value is multiline, so need to continue until consuming until " .\n"
					const multilineRegex = /(?<=\s(return|\+?=|if|switch|for|throw|unless|- target|\?|<!) ).+?\s+\.$/smy;
					multilineRegex.lastIndex = offset;
					const multiLineMatch = multilineRegex.exec(text);
					if (multiLineMatch == null) {
						console.error('Expected multiline attribute value to end in " .\\n"');
						return null;
					}
					multiLineMatch[0] = multiLineMatch[0].replace(/ &$/m, '  ').replace(/(\s+)\.$/m, '$1 ');
					return multiLineMatch;
				}
				return singleLineMatch;
			}
		}
		return tokenType;
	}
}

export class SnakeskinLexer extends IndentationAwareLexer {
	override tokenize(text: string): LexerResult {
		const result = super.tokenize(text);
		let {errors, hidden, tokens} = result;

		// remove any indent/dedent tokens sandwiched between 2 TEXT tokens
		for (let i = 0; i < tokens.length - 2; i++) {
			const [prev, current, next] = tokens.slice(i, i + 3);
			if (prev.tokenType.name === 'TEXT' && next.tokenType.name === 'TEXT' && ['INDENT', 'DEDENT'].includes(current.tokenType.name)) {
				tokens.splice(i + 1, 1);
			}
		}

		return {
			errors, hidden, tokens,
		};
	}
}
