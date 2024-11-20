// @ts-nocheck

// This file is not actually used anywhere.
// It is left here just as a reference for how source-to-generated position mapping could be done using
// the "source-map" library in the future, in case it proves to be worth it (performance-wise).
// https://www.typefox.io/blog/code-generation-for-langium-based-dsls-3/

// It can also be done manually using a Segment Tree data structure:
// https://github.com/PinkyJie/data-structure-ts/blob/master/segment-tree/segment-tree.ts
// without depending on the source-map library

import { TreeStreamImpl, AstUtils } from 'langium';
import { SourceMapConsumer, SourceMapGenerator, StartOfSourceMap } from 'source-map';
import { generateTypeScript } from '.';
import { Module } from '../generated/ast';

const module = AstUtils.findRootNode(node) as Module;
const { uri } = AstUtils.getDocument(node).textDocument;

const ts = generateTypeScript(module);

const {text, trace} = ts;
const mapper = new SourceMapGenerator(<StartOfSourceMap>{ file: uri });
const sourceDefinitionText = module.$cstNode?.text ?? '';
mapper.setSourceContent(uri, sourceDefinitionText);

new TreeStreamImpl(trace, r => r.children ?? [], { includeRoot: true }).forEach(r => {
    if (!r.sourceRegion
        || !r.targetRegion
        || r.children?.[0].targetRegion.offset === r.targetRegion.offset /* if the first child starts at the same position like this (potentially encompassing) region, skip this one and continue with the child(ren) */
    ) {
        return;
    }

    const sourceStart = r.sourceRegion.range?.start;
    const targetStart = r.targetRegion.range?.start;

    const sourceEnd = r.sourceRegion?.range?.end;
    const sourceText = sourceEnd && sourceDefinitionText.length >= r.sourceRegion.end
        ? sourceDefinitionText.substring(r.sourceRegion.offset, r.sourceRegion.end) : ''

    sourceStart && targetStart && mapper.addMapping({
        original:  { line: sourceStart.line + 1, column: sourceStart.character },
        generated: { line: targetStart.line + 1, column: targetStart.character },
        source: uri,
        // name: /^[A-Za-z_]$/.test(sourceText) ? sourceText.toLowerCase() : undefined
    });

    // const sourceEnd = r.sourceRegion?.range?.end;
    // const sourceText = sourceEnd && sourceDefinitionText.length >= r.sourceRegion.end
    //     ? sourceDefinitionText.substring(r.sourceRegion.offset, r.sourceRegion.end) : ''
    const targetEnd = r.targetRegion?.range?.end;
    const targetText = targetEnd && text.length >= r.targetRegion.end
        ? text.substring(r.targetRegion.offset, r.targetRegion.end) : ''

    sourceEnd && targetEnd && !r.children && sourceText && targetText
            && !/\s/.test(sourceText) && !/\s/.test(targetText)
            && mapper.addMapping({
        original:  { line: sourceEnd.line + 1, column: sourceEnd.character },
        generated: { line: targetEnd.line + 1, column: targetEnd.character},
        source: uri
    });
});

const consumer = await SourceMapConsumer.fromSourceMap(mapper);

if (range) {
    const position = consumer.generatedPositionFor({
        line: range.start.line,
        column: range.start.character,
        source: uri
    });
}

// Additionally, the following needs to be added to ESBuild plugins:
// {
//     name: 'copy-sourcemap-wasm',
//     setup(build) {
//         build
//         build.onEnd(() => {
//             const wasmPath = new URL(import.meta.resolve('source-map/lib/mappings.wasm'));
//             fs.copyFileSync(wasmPath.pathname, './out/language/mappings.wasm');
//         })
//     }
// }
