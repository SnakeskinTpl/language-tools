import { AstUtils, LeafCstNode, MaybePromise } from "langium";
import { DefaultDefinitionProvider } from "langium/lsp";
import { SnakeskinServices } from "./snakeskin-module";
import { DefinitionParams, LocationLink, Range } from 'vscode-languageserver';
import { isInclude } from "./generated/ast";
import { TypeScriptServices } from "./typescript-service";

export class SnakeskinDefinitionProvider extends DefaultDefinitionProvider {
    protected ts: TypeScriptServices;

    constructor(services: SnakeskinServices) {
        super(services);
        this.ts = services.TypeScript;
    }

    protected override collectLocationLinks(sourceCstNode: LeafCstNode, params: DefinitionParams): MaybePromise<LocationLink[] | undefined> {
        const node = sourceCstNode.astNode;
        if (isInclude(node)) {
            const doc = AstUtils.getDocument(node);
            const importTargets = this.ts.resolveSnakeskinInclude(node.path, doc.uri);

            return importTargets.map(uri => LocationLink.create(
                uri.toString(),
                Range.create(0, 0, 0, 0),
                Range.create(0, 0, 0, 0),
                sourceCstNode.range,
            ));
        }
        return super.collectLocationLinks(sourceCstNode, params);
    }
}
