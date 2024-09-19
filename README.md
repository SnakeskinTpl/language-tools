# Snakeskin Language Tools

This project contains the language tooling for Snakeskin.
It consists of the following packages:

- [packages/language](./packages/language/README.md): The language definition and implementation of core language features.
- [packages/cli](./packages/cli/README.md): A command-line interface exposing an LSP server for use outside of VS Code.
- [packages/extension](./packages/extension/langium-quickstart.md): Contains the VSCode extension.
- [packages/web](./packages/web/README.md): Contains the language server running in a web browser and a monaco-editor with language support similar to the one from VSCode. Useful as a playground for experimenting with the language.
- [packages/intellij-plugin](./packages/intellij-plugin/README.md): A plugin for IntelliJ-based editors using LSP.
- [packages/neovim](./packages/neovim/README.md): LSP setup for Neovim.

## What's in the folder?

Some file are contained in the root directory as well.

- [package.json](./package.json) - The manifest file the main workspace package
- [tsconfig.json](./tsconfig.json) - The base TypeScript compiler configuration
- [tsconfig.build.json](./package.json) - Configuration used to build the complete source code.
- [.eslintrc.json](.eslintrc.json) - Configuration file for eslint
- [.gitignore](.gitignore) - Files ignored by git
