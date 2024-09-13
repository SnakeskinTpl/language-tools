import { type Module, inject } from 'langium';
import { createDefaultModule, createDefaultSharedModule, type DefaultSharedModuleContext, type LangiumServices, type LangiumSharedServices, type PartialLangiumServices } from 'langium/lsp';
import { SnakeskinGeneratedModule, SnakeskinGeneratedSharedModule } from './generated/module.js';
import { SnakeskinValidator, registerValidationChecks } from './snakeskin-validator.js';
import { SnakeskinTokenBuilder, SnakeskinLexer } from './parser/snakeskin-lexer.js';
import { SemanticTokenProvider } from './semantic-tokens.js';
import { HoverProvider } from './hover-provider.js';
import { TypeScriptServices } from './typescript-service.js';

/**
 * Declaration of custom services - add your own service classes here.
 */
export type SnakeskinAddedServices = {
    validation: {
        SnakeskinValidator: SnakeskinValidator
    },
    TypeScript: TypeScriptServices,
}

/**
 * Union of Langium default services and your custom services - use this as constructor parameter
 * of custom service classes.
 */
export type SnakeskinServices = LangiumServices & SnakeskinAddedServices

/**
 * Dependency injection module that overrides Langium default services and contributes the
 * declared custom services. The Langium defaults can be partially specified to override only
 * selected services, while the custom services must be fully specified.
 */
export const SnakeskinModule: Module<SnakeskinServices, PartialLangiumServices & SnakeskinAddedServices> = {
    parser: {
        TokenBuilder: () => new SnakeskinTokenBuilder(),
        Lexer: (services) => new SnakeskinLexer(services),
    },
    validation: {
        SnakeskinValidator: () => new SnakeskinValidator(),
    },
    lsp: {
        SemanticTokenProvider: (services) => new SemanticTokenProvider(services),
        HoverProvider: (services) => new HoverProvider(services),
    },
    TypeScript: (services) => new TypeScriptServices(services),
};

/**
 * Create the full set of services required by Langium.
 *
 * First inject the shared services by merging two modules:
 *  - Langium default shared services
 *  - Services generated by langium-cli
 *
 * Then inject the language-specific services by merging three modules:
 *  - Langium default language-specific services
 *  - Services generated by langium-cli
 *  - Services specified in this file
 *
 * @param context Optional module context with the LSP connection
 * @returns An object wrapping the shared services and the language-specific services
 */
export function createSnakeskinServices(context: DefaultSharedModuleContext): {
    shared: LangiumSharedServices,
    Snakeskin: SnakeskinServices
} {
    const shared = inject(
        createDefaultSharedModule(context),
        SnakeskinGeneratedSharedModule
    );
    const Snakeskin = inject(
        createDefaultModule({ shared }),
        SnakeskinGeneratedModule,
        SnakeskinModule
    );
    shared.ServiceRegistry.register(Snakeskin);
    registerValidationChecks(Snakeskin);
    if (!context.connection) {
        // We don't run inside a language server
        // Therefore, initialize the configuration provider instantly
        shared.workspace.ConfigurationProvider.initialized({});
    }
    return { shared, Snakeskin };
}
