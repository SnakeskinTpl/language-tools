# Snakeskin IntelliJ plugin

<!-- Plugin description -->

<!-- This specific section is a source for the [plugin.xml](/packages/intellij-plugin/src/main/resources/META-INF/plugin.xml) file which will be extracted by the [Gradle](/packages/intellij-plugin/build.gradle.kts) during the build process.
To keep everything working, do not remove the comments wrapping the section. -->

This plugin adds support for the Snakeskin language in JetBrains IntelliJ-based IDEs.
Currently, the following features are supported:
- Syntax highlighting
- Diagnostic messages (for parsing errors)

Only Jade-like syntax is supported.

<!-- Plugin description end -->

## Installation

- Using the IDE built-in plugin system:

  <kbd>Settings/Preferences</kbd> > <kbd>Plugins</kbd> > <kbd>Marketplace</kbd> > Search for "<kbd>Snakeskin</kbd>" >
  <kbd>Install</kbd>

- Using JetBrains Marketplace:

  Go to [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/14182-snakeskin) and install it by clicking the <kbd>Install to ...</kbd> button in case your IDE is running.

  You can also download the [latest release](https://plugins.jetbrains.com/plugin/14182-snakeskin/versions) from JetBrains Marketplace and install it manually using
  <kbd>Settings/Preferences</kbd> > <kbd>Plugins</kbd> > <kbd>⚙️</kbd> > <kbd>Install plugin from disk...</kbd>

- Manually:

  Download the [latest release](https://github.com/SnakeskinTpl/vscode-snakeskin/releases/latest) and install it manually using
  <kbd>Settings/Preferences</kbd> > <kbd>Plugins</kbd> > <kbd>⚙️</kbd> > <kbd>Install plugin from disk...</kbd>

---
Plugin based on the [IntelliJ Platform Plugin Template][template].

[template]: https://github.com/JetBrains/intellij-platform-plugin-template
