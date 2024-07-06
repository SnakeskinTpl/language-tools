import type { ValidationAcceptor, ValidationChecks } from 'langium';
import type { SnakeskinAstType, Person } from './generated/ast.js';
import type { SnakeskinServices } from './snakeskin-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: SnakeskinServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SnakeskinValidator;
    const checks: ValidationChecks<SnakeskinAstType> = {
        Person: validator.checkPersonStartsWithCapital
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class SnakeskinValidator {

    checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
        if (person.name) {
            const firstChar = person.name.substring(0, 1);
            if (firstChar.toUpperCase() !== firstChar) {
                accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' });
            }
        }
    }

}
