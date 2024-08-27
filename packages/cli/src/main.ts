import type { Module } from '@snakeskin/language';
import { createSnakeskinServices, SnakeskinLanguageMetaData } from '@snakeskin/language';
import chalk from 'chalk';
import { Command } from 'commander';
import { extractAstNode } from './util.js';
import { generateJavaScript } from './generator.js';
import { NodeFileSystem } from 'langium/node';
import { startLanguageServer } from 'langium/lsp';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

export const generateAction = async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createSnakeskinServices(NodeFileSystem).Snakeskin;
    const model = await extractAstNode<Module>(fileName, services);
    const generatedFilePath = generateJavaScript(model, fileName, opts.destination);
    console.log(chalk.green(`JavaScript code generated successfully: ${generatedFilePath}`));
};

export type GenerateOptions = {
    destination?: string;
}

export const lspAction = () => {
    const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
    const { shared } = createSnakeskinServices({ connection, ...NodeFileSystem });
    startLanguageServer(shared);
}

export default function(): void {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    const fileExtensions = SnakeskinLanguageMetaData.fileExtensions.join(', ');
    program
        .command('generate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .option('-d, --destination <dir>', 'destination directory of generating')
        .description('generates JavaScript code from the source Snakeskin code')
        .action(generateAction);

    program
        .command('lsp')
        .option('--stdio', 'run in STDIO mode (for compatibility with non-Node clients)')
        .description('runs the standalone LSP server')
        .action(lspAction);

    program.parse(process.argv);
}
