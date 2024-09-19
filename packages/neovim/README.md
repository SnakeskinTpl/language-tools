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
- Go to declaration by include derective
- Include derective validation for paths exist

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

For plugin we need globally pre-installed @snakeskin/cli because plugin run cli command

      npm i -g @snakeskin/cli

### Automatic setup

If you want the cli to be installed automatically when run nvim or open *.ss file, you should add mason tools managment plugins

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

If you install cli by npm, you could update lsp like other npm packages.

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
