import { AstUtils, LeafCstNode, MaybePromise, UriUtils } from "langium";
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
            const importTargets = this.ts.resolveSnakeskinInclude(node.path, doc.uri.path);

            return importTargets.map(target => LocationLink.create(
                // The import target is converted to URI (even though it is already an absolute path) to match the format used
                // by the indexManager, which is the string version of a URI (the main difference is that it includes the protocol)
                UriUtils.resolvePath(doc.uri, target).toString(),
                Range.create(0, 0, 0, 0),
                Range.create(0, 0, 0, 0),
                sourceCstNode.range,
            ));
        }
        return super.collectLocationLinks(sourceCstNode, params);
    }
}
