import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { globSync } from "glob";
import type { SnakeskinServices } from "./snakeskin-module";

export class TypeScriptServices {
    protected readonly languageService: ts.LanguageService;
    protected readonly options: ts.CompilerOptions;

    constructor(services: SnakeskinServices) {
        this.options = TypeScriptServices.getCompilerOptions();

        const host: ts.LanguageServiceHost = {
            getCompilationSettings: () => this.options,
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
    };

    private static getCompilerOptions(): ts.CompilerOptions {
        const currentDir = ts.sys.getCurrentDirectory();
        const path = ts.findConfigFile(currentDir, ts.sys.fileExists);
        if (path == null) {
            return ts.getDefaultCompilerOptions();
        }
        const json = ts.parseJsonText(path, fs.readFileSync(path, { encoding: 'utf-8' }));
        const parsed = ts.parseJsonSourceFileConfigFileContent(json, ts.sys, currentDir);
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
    private resolveSnakeskinIncludeHelper(includePath: string, containingFile: string, options: ts.CompilerOptions): string[] {
        const { resolvedModule } = ts.resolveModuleName(includePath, containingFile, options, TypeScriptServices.snakeskinModuleResolutionHost);
        let { resolvedFileName } = resolvedModule ?? {};

        if (resolvedFileName == null) return [];

        resolvedFileName = resolvedFileName.replace('.ss.ts', '.ss');

        if (resolvedFileName.includes('*')) {
            return globSync(resolvedFileName);
        }
        return [resolvedFileName];
    }

    /**
     * Attempts to resolve includes in Snakeskin (with glob support).
     * Currently, this is specific to the usage in V4Fire and assumes the usage of the 'b' filter.
     * It reuses the resolution algorithm of TypeScript instead of reimplementing the exact logic of the 'b' filter.
     *
     * @param includePath The path specified in the include directive
     * @param containingFile The path of the file in which the include directive is used
     * @returns The resolved absolute path(s). Can be an array due to possibility of globs.
     */
    resolveSnakeskinInclude(includePath: string, containingFile: string): string[] {
        if (this.options == null) {
            return [];
        }

        if (includePath.endsWith('.ss')) {
            // Importing a specific file directly
            return this.resolveSnakeskinIncludeHelper(includePath, containingFile, this.options);
        } else {
            // Importing a directory
            // 1- Try appending the final dirname with .ss extension
            const attempt1 = this.resolveSnakeskinIncludeHelper(`${includePath}/${path.basename(includePath)}.ss`, containingFile, this.options);
            if (attempt1 != null) { return attempt1; }

            // 2- Try appending "main.ss"
            const attempt2 = this.resolveSnakeskinIncludeHelper(`${includePath}/main.ss`, containingFile, this.options);
            if (attempt2 != null) { return attempt2; }

            // 3- Try appending "index.ss"
            const attempt3 = this.resolveSnakeskinIncludeHelper(`${includePath}/index.ss`, containingFile, this.options);
            return attempt3;
        }
    }
}
