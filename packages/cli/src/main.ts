import type { Module } from '@snakeskin/language';
import { createSnakeskinServices, SnakeskinLanguageMetaData } from '@snakeskin/language';
import chalk from 'chalk';
import { Command } from 'commander';
import { extractAstNode, extractDocument } from './util.js';
import { generateJavaScript } from './generator.js';
import { NodeFileSystem } from 'langium/node';
import { startLanguageServer } from 'langium/lsp';
import { createConnection, ProposedFeatures, DiagnosticSeverity } from 'vscode-languageserver/node.js';
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

export const validateAction = async (fileName: string) => {
    const services = createSnakeskinServices(NodeFileSystem).Snakeskin;
    const {diagnostics = []} = await extractDocument(fileName, services);
    const errors = diagnostics.filter(diag => diag.severity === DiagnosticSeverity.Error);
    const warnings = diagnostics.filter(diag => diag.severity === DiagnosticSeverity.Warning);

    if (warnings.length > 0) {
        console.warn(chalk.yellow(`Found ${warnings.length} warning(s):`));
        for (const warning of warnings) {
            console.warn(chalk.yellow(`line ${warning.range.start.line + 1}: ${warning.message}`));
        }
    }

    if (errors.length > 0) {
        console.error(chalk.red(`Found ${errors.length} error(s):`));
        for (const validationError of errors) {
            console.error(chalk.red(`line ${validationError.range.start.line + 1}: ${validationError.message}`));
        }
        process.exit(1);
    }

    if (warnings.length === 0 && errors.length === 0) {
        console.log(chalk.green('Document is valid!'));
    }
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

    program
        .command('validate')
        .argument('<file>', `source file (possible file extensions: ${fileExtensions})`)
        .description('parses and validates Snakeskin files')
        .action(validateAction);

    program.parse(process.argv);
}
