import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { SnakeskinAstType, Attribute } from './generated/ast.js';
import type { SnakeskinServices } from './snakeskin-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: SnakeskinServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SnakeskinValidator;
    const checks: ValidationChecks<SnakeskinAstType> = {
        Attribute: [validator.validateAttributesMissingBar],
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class SnakeskinValidator {

    /**
     * Check for possibly missing a  ' | ' after an attribute value by finding a line in the value
     * with the same indendation level as the attribute key which is not the last line.
     */
    validateAttributesMissingBar(attr: Attribute, accept: ValidationAcceptor): void {
        if (attr.$cstNode == null) return;
        const {range: {start, end}, text} = attr.$cstNode;
        if (start.line === end.line) {
            // single-line attribute
            return;
        }

        const originalIndentation = start.character;
        const lines = text.split('\n');
        const lineWithMatchingIndent = lines.slice(1).findIndex((line) => {
            const indentation = line.search(/\S/);
            // This should also have the condition that `line !== ''` to alse catch attributes with empty lines in between
            // but there is a lot of actual code already written that has an empty line inside the attribute value
            if (indentation === -1) return false;
            return indentation <= originalIndentation;
        });
        // When only the value is multi-line, there are usually no other attributes after it anyway
        const isValueMultiline = lines[0]?.endsWith(' &') ?? false;
        const isLastInMultiline =  lineWithMatchingIndent === lines.length - 1 - 1 && lines.length > 2;

        if (lineWithMatchingIndent !== -1 && !isLastInMultiline && !isValueMultiline) {
            const line = start.line + lineWithMatchingIndent;
            const startChar = lines[lineWithMatchingIndent].length;
            const endChar = lines[lineWithMatchingIndent + 1].length;
            console.log('found offense!', line, startChar, endChar)
            accept(
                'warning',
                "This line has the same indentation as the attribute key. Are you sure you didn't forget a ` | `?",
                {
                    node: attr,
                    range: {
                        start: {line, character: startChar},
                        end: {line: line + 1, character: endChar}
                    },
                }
            );
        }
    }

}
