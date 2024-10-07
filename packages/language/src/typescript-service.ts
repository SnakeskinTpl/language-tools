import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { globSync } from "glob";
import { URI } from "langium";
import type { SnakeskinServices } from "./snakeskin-module";

export class TypeScriptServices {
    protected readonly languageService: ts.LanguageService;
    /** A mapping from workspace root URI path to compiler options */
    protected readonly options: Record<string, ts.CompilerOptions> = {};

    constructor(services: SnakeskinServices) {
        const host: ts.LanguageServiceHost = {
            getCompilationSettings: () => this.getCompilerOptions(ts.sys.getCurrentDirectory()),
            getScriptFileNames: () => {
                // TODO
                return [];
            },
            getScriptVersion: (fileName: string) => {
                // TODO
                return '0';
            },
            getScriptSnapshot: (fileName: string) => {
                // TODO: check if this implementation is correct
                if (!ts.sys.fileExists(fileName)) { return; }
                return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName, { encoding: 'utf-8' }));
            },
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
        const { resolvedModule } = ts.resolveModuleName(includePath, containingFile.toString(), options, TypeScriptServices.snakeskinModuleResolutionHost);
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
}
