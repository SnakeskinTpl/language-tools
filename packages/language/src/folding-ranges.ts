import type { CstNode } from "langium";
import { DefaultFoldingRangeProvider } from "langium/lsp";
import { isAttribute } from "./generated/ast";

export class SnakeskinFoldingRangeProvider extends DefaultFoldingRangeProvider {
    protected override includeLastFoldingLine(node: CstNode, kind?: string): boolean {
        const lastLineisNotNewline = !node.text.endsWith('\n');
        // To display the ` |`
        const isLastAttribute = !isAttribute(node.astNode) || node.astNode.$container.attrs.at(-1) === node.astNode;

        return lastLineisNotNewline && isLastAttribute;
    }
}
