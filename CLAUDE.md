# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repo adds HH:MM:SS timestamps to Claude Code's tool-use headers in the terminal UI. It's a Nix flake that overrides the `claude-code` nixpkgs package, running a post-install JavaScript patch on the minified `cli.js`.

The binary is called `claude-ts`.

## Build

```bash
nix build            # builds .#claude-ts (the default package)
nix build .#claude-ts  # explicit
```

There are no tests or lint commands - verification is a `node --check cli.js` syntax check run automatically by the patch script on success.

## Architecture

Two files matter:

- **`flake.nix`** - Overrides `pkgs.claude-code` with a `postFixup` that runs the patch script and creates a `claude-ts` symlink.
- **`patch-timestamps.js`** - Node.js script that regex-patches the minified `cli.js`. Applies two patches:
  1. **Individual tool headers** (Bash, Edit, Write, etc.) - Finds React `createElement` calls with `justifyContent:"space-between"` near `resolvedToolUseIDs`/`renderToolUseTag`, then injects a timestamp element as a second child.
  2. **Collapsed read/search groups** (Read, Grep, Glob summaries) - Finds `TeamMemCountParts` calls, wraps the row in a `space-between` container, and appends a timestamp element. Also patches the outer column to add `width:"100%"`.

Both patches use `globalThis.__toolTs` as a cache keyed by tool ID to prevent timestamp re-renders.

## Updating for New Claude Code Versions

The patch relies on stable structural patterns in the minified code (e.g., `justifyContent:"space-between"`, `resolvedToolUseIDs`, `TeamMemCountParts`). Minified variable names (React, Box, Text, param vars) change between versions but are discovered dynamically by the script's regexes.

When a new version breaks the patch:
1. Build and check which patch(es) failed from the console output
2. Examine the new `cli.js` to find how the target patterns shifted
3. Update the regexes in `patch-timestamps.js` accordingly
4. Verify with `node --check cli.js` (done automatically by the script)

## NixOS Notes

This is a NixOS system. Always use `#!/usr/bin/env bash` (or appropriate `env` wrapper) in shebangs - never hardcode paths like `/bin/bash`.

## Everything Else

The `README.md`, `plugins/`, `examples/`, `scripts/`, and `.github/` directories are from the upstream claude-code repo. The timestamp modification only touches `flake.nix` and `patch-timestamps.js`.
