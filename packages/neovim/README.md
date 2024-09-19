# Snakeskin Neovim plugin

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Setup](#setup)
- [Update](#update)

## Introduction

This plugin adds support for the Snakeskin language in Neovim.
Currently, the following features are supported:

- Syntax highlighting
- Diagnostic messages (for parsing errors)
- Go to definition for `include` directive
- `include` directive validation for paths existence

Only Jade-like syntax is supported.

## Installation

### [lazy.nvim](https://github.com/folke/lazy.nvim)

```lua
{
    "neovim/nvim-lspconfig",
    opts = {
        servers = {
            snakeskin_ls = {}
        }
    }
}
```

## Setup

### Manual setup

For the plugin to work, we need to install `@snakeskin/cli` globally because the plugin runs the LSP server through a CLI subcommand:

      npm i -g @snakeskin/cli

### Automatic setup

If you want the CLI to be installed automatically when running `nvim` or opening a `*.ss` file, you should add the mason package manager plugin:

[lazy.nvim](https://github.com/folke/lazy.nvim)

```lua
{
    "williamboman/mason.nvim",
    "williamboman/mason-lspconfig.nvim",
    {
        "neovim/nvim-lspconfig",
        opts = {
            servers = {
                snakeskin_ls = {}
            }
        }
    }
}
```

## Update

### Manual update

If you install the CLI using npm, you can update the LSP server like other npm packages:

    npm update -g @snakeskin/cli

### Automatic update

If you use mason, you can see updates and update cli in `:Mason` menu or update it automatically with [Mason Tool Installer](https://github.com/WhoIsSethDaniel/mason-tool-installer.nvim)

```lua
{
    "WhoIsSethDaniel/mason-tool-installer.nvim",
    config = function()
        require('mason-tool-installer').setup({
            ensure_installed = {
                "snakeskin-cli"
            },
            auto_update = true
        })
    end
}
```
