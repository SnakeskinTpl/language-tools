# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.4] - 2024-08-15

### Added

- Hover information for the placeholders `%fileName%` and `%dirName%`.
- Validation for missing ` | ` between multi-line attributes.

### Fixed

- Minor improvements to attribute parsing

## [0.0.3] - 2024-07-30

### Added

- Syntax highlighting using the TextMate grammar file from the [old extension](https://github.com/baranovxyz/vscode-snakeskin-lang).

### Fixed

- Improved the parser to handle more cases. Now it can parse V4Fire/Client correctly.
- Hover information was not working due to missing range information.

## [0.0.2] - 2024-07-25

Initial release with basic semantic highlighting and hover information

[Unreleased]: https://github.com/SnakeskinTpl/vscode-snakeskin/compare/v0.0.4...HEAD
[0.0.4]: https://github.com/SnakeskinTpl/vscode-snakeskin/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/SnakeskinTpl/vscode-snakeskin/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/SnakeskinTpl/vscode-snakeskin/releases/tag/v0.0.2
