import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { globSync } from "glob";
import { URI, DocumentState, type LangiumDocument } from "langium";
import type { TraceRegion } from "langium/generate";
import type { SnakeskinServices } from "./snakeskin-module";
import { generateTypeScript, mapSourceOffsetToGenerated } from "./generator";
import type { Module } from "./generated/ast";

/**
 * A TypeScript file generated from Snakeskin code just for IntelliSense purposes
 */
export interface SnakeskinTypeScriptFile {
    /** The content of the original Snakeskin file */
    originalContent: string;
    /** The generated TypeScript code for the Snakeskin file */
    generatedContent: string;
    /** Mapping between source location and generated locations */
    trace: TraceRegion;
    snapshot: ts.IScriptSnapshot;
    version: number;
}

export class TypeScriptServices {
    protected readonly languageService: ts.LanguageService;
    /** A mapping from workspace root URI path to compiler options */
    protected readonly options: Record<string, ts.CompilerOptions> = {};

    /**
     * Mapping from SS file URI to its equivalent TS snapshot and version number.
     * A value of null means the file is
     */
    protected files: Map<string, SnakeskinTypeScriptFile | null> = new Map();

    constructor(services: SnakeskinServices) {
        const host: ts.LanguageServiceHost = {
            getCompilationSettings: () => this.getCompilerOptions(ts.sys.getCurrentDirectory()),
            getScriptFileNames: () =>  [...this.files.keys()],
            getScriptVersion: (fileName: string) => this.files.get(fileName)?.version?.toString() ?? '',
            getScriptSnapshot: (fileName: string) => this.files.get(fileName)?.snapshot,
            getCurrentDirectory: ts.sys.getCurrentDirectory,
            getDefaultLibFileName: ts.getDefaultLibFilePath,
            fileExists: ts.sys.fileExists,
            readFile: ts.sys.readFile,
        };

        const docRegistry = ts.createDocumentRegistry(ts.sys.useCaseSensitiveFileNames, ts.sys.getCurrentDirectory());

        this.languageService = ts.createLanguageService(host, docRegistry);

        void services.shared.workspace.WorkspaceManager.ready.then(() => {
            services.shared.workspace.WorkspaceManager.workspaceFolders.forEach(folder => {
                this.options[folder.uri] = this.getCompilerOptions(URI.parse(folder.uri).path);
            });
        });

        // Register open files to watch their phases
        services.shared.workspace.TextDocuments.onDidOpen(({ document }) => {
            const path = TypeScriptServices.snakeskinUriToTsPath(document.uri);
            if (!this.files.has(path)) {
                this.files.set(path, null);
            }
        });

        // Clean up when closing to avoid memory leaks
        services.shared.workspace.TextDocuments.onDidClose(({ document }) => {
            const path = TypeScriptServices.snakeskinUriToTsPath(document.uri);
            this.files.delete(path);
        });

        // Convert watched (open) Snakeskin files to TypeScript once they are parsed and ready
        services.shared.workspace.DocumentBuilder.onDocumentPhase(DocumentState.IndexedReferences, (doc) => {
            const path = TypeScriptServices.snakeskinUriToTsPath(doc.uri);
            if (this.files.has(path)) {
                this.addSnakeskinFile(doc as LangiumDocument<Module>);
            }
        });
    };

    private getCompilerOptions(rootPath: string): ts.CompilerOptions {
        // `findConfigFile` operates on file system paths, not URI (cannot have "file://" protocol)
        const path = ts.findConfigFile(rootPath, ts.sys.fileExists);
        if (path == null) {
            return ts.getDefaultCompilerOptions();
        }
        const json = ts.parseJsonText(path, fs.readFileSync(path, { encoding: 'utf-8' }));
        const parsed = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, rootPath);
        return parsed.options;
    }

    private static readonly snakeskinModuleResolutionHost: ts.ModuleResolutionHost = {
        fileExists: (path) => {
            path = path.replace('.ss.ts', '.ss');
            if (path.includes('*')) {
                const matches = globSync(path);
                return matches.length > 0;
            }
            return ts.sys.fileExists(path);
        },
        readFile: ts.sys.readFile,
    };

    /**
     * Internal helper for {@link resolveSnakeskinInclude} to minmize repetition.
     */
    private resolveSnakeskinIncludeHelper(includePath: string, containingFile: URI, options: ts.CompilerOptions): URI[] {
        const { resolvedModule } = ts.resolveModuleName(includePath, containingFile.fsPath, options, TypeScriptServices.snakeskinModuleResolutionHost);
        let { resolvedFileName } = resolvedModule ?? {};

        if (resolvedFileName == null) return [];

        resolvedFileName = resolvedFileName.replace('.ss.ts', '.ss');

        if (resolvedFileName.includes('*')) {
            return globSync(resolvedFileName).map(path => URI.parse(path));
        }
        return [URI.parse(resolvedFileName)];
    }

    /**
     * Attempts to resolve includes in Snakeskin (with glob support).
     * Currently, this is specific to the usage in V4Fire and assumes the usage of the 'b' filter.
     * It reuses the resolution algorithm of TypeScript instead of reimplementing the exact logic of the 'b' filter.
     *
     * @param includePath The path specified in the include directive
     * @param containingFile The URI of the file in which the include directive is used
     * @returns The resolved absolute path(s). Can be an array due to possibility of globs.
     */
    resolveSnakeskinInclude(includePath: string, containingFile: URI): URI[] {
        // Ignore the 'as' part (not relevant for path resolution)
        includePath = includePath.split(':')[0];

        const options = Object.entries(this.options).find(([workspace, ]) => {
            return containingFile.toString().startsWith(workspace);
        })?.[1];

        if (options == null) {
            return [];
        }

        if (includePath.endsWith('.ss')) {
            // Importing a specific file directly
            return this.resolveSnakeskinIncludeHelper(includePath, containingFile, options);
        } else {
            // Importing a directory
            // 1- Try appending the final dirname with .ss extension
            const attempt1 = this.resolveSnakeskinIncludeHelper(`${includePath}/${path.basename(includePath)}.ss`, containingFile, options);
            if (attempt1.length > 0) { return attempt1; }

            // 2- Try appending "main.ss"
            const attempt2 = this.resolveSnakeskinIncludeHelper(`${includePath}/main.ss`, containingFile, options);
            if (attempt2.length > 0) { return attempt2; }

            // 3- Try appending "index.ss"
            const attempt3 = this.resolveSnakeskinIncludeHelper(`${includePath}/index.ss`, containingFile, options);
            return attempt3;
        }
    }

    private static snakeskinUriToTsPath(uri: URI | string): string {
        if (typeof uri === 'string') {
            uri = URI.parse(uri);
        }
        return uri.fsPath + ".ts";
    }

    /**
     * Adds (or updates) a Snakeskin file to the list of files watched by the TypeScript language service.
     */
    protected addSnakeskinFile(document: LangiumDocument<Module>): void {
        const fileTsPath = TypeScriptServices.snakeskinUriToTsPath(document.uri);
        const module = document.parseResult.value;

        const generated = generateTypeScript(module);
        if (generated == undefined) {
            return;
        }

        const { text, trace } = generated;

        const file = this.files.get(fileTsPath);

        this.files.set(fileTsPath, {
            originalContent: document.textDocument.getText(),
            generatedContent: text,
            trace,
            snapshot: ts.ScriptSnapshot.fromString(text),
            version: file?.version != null ? (file.version + 1) : 0,
        });
    }

    /**
     * Computes the content of the hover popup on a const directive
     *
     * @param fileName The file in which the user is currently hovering on a "const"
     * @param ssOffset The text offset inside that file
     * @returns The content of the hover popup
     */
    getConstHoverInfo(fileName: string, ssOffset: number): string | undefined {
        fileName = TypeScriptServices.snakeskinUriToTsPath(fileName);
        const file = this.files.get(fileName);
        if (file == null) {
            return;
        }

        const tsOffset = mapSourceOffsetToGenerated(ssOffset, file.trace)?.offset;
        if (tsOffset == undefined) {
            return;
        }

        const info = this.languageService.getQuickInfoAtPosition(fileName, tsOffset);
        return "```ts\n" + ts.displayPartsToString(info?.displayParts) + "\n```";
    }
}
