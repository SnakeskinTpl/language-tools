import * as path from 'node:path';
import * as fs from 'node:fs';
import chalk from 'chalk';
import type { AstNode, LangiumCoreServices, LangiumDocument } from 'langium';
import { URI } from 'langium';
import type { TextRegion, TraceRegion } from 'langium/generate';

/**
 * Given an offset in the source (Snakeskin) document and a sourcemap (trace object)
 * to the generated TypeScript, returns the corresponding offset (if any) in the
 * generated file to be used when querying with the TypeScript language service.
 */
export function mapSourceOffsetToGenerated(sourceOffset: number, map: TraceRegion): TextRegion | null {
    if (!map.sourceRegion) return null;
    if (map.sourceRegion.offset === sourceOffset) {
        return map.targetRegion;
    }
    for (const child of map.children ?? []) {
        const mapping = mapSourceOffsetToGenerated(sourceOffset, child);
        if (mapping) {
            return mapping;
        }
    }
    return null;
}

// The following functions are mostly CLI utils copied from the template and not moved to the appropriate package yet.
// They are left here just as a reference for now

export async function extractDocument(fileName: string, services: LangiumCoreServices): Promise<LangiumDocument> {
    const extensions = services.LanguageMetaData.fileExtensions;
    if (!extensions.includes(path.extname(fileName))) {
        console.error(chalk.yellow(`Please choose a file with one of these extensions: ${extensions}.`));
        process.exit(1);
    }

    if (!fs.existsSync(fileName)) {
        console.error(chalk.red(`File ${fileName} does not exist.`));
        process.exit(1);
    }

    const document = await services.shared.workspace.LangiumDocuments.getOrCreateDocument(URI.file(path.resolve(fileName)));
    await services.shared.workspace.DocumentBuilder.build([document], { validation: true });

    return document;
}

export async function extractDocuments(fileOrDirName: string, services: LangiumCoreServices): Promise<LangiumDocument[]> {
    if (!fs.existsSync(fileOrDirName)) {
        console.error(chalk.red(`No such file or directory: ${fileOrDirName}.`));
        process.exit(1);
    }
    if (!fs.lstatSync(fileOrDirName).isDirectory()) {
        return [await extractDocument(fileOrDirName, services)];
    }
    const extensions = services.LanguageMetaData.fileExtensions;
    const files = fs.readdirSync(fileOrDirName, { encoding:'utf8', recursive: true })
                    .filter(file => extensions.includes(path.extname(file)));
    return Promise.all(files.map(file => extractDocument(path.join(fileOrDirName, file), services)));
}


export async function extractAstNode<T extends AstNode>(fileName: string, services: LangiumCoreServices): Promise<T> {
    return (await extractDocument(fileName, services)).parseResult?.value as T;
}

interface FilePathData {
    destination: string,
    name: string
}

export function extractDestinationAndName(filePath: string, destination: string | undefined): FilePathData {
    filePath = path.basename(filePath, path.extname(filePath)).replace(/[.-]/g, '');
    return {
        destination: destination ?? path.join(path.dirname(filePath), 'generated'),
        name: path.basename(filePath)
    };
}