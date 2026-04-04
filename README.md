# Claude Code TS (modified fork)

> **This is a modified version of [Claude Code](https://github.com/anthropics/claude-code)** packaged as a Nix flake. It patches the minified `cli.js` at build time to add:
>
> - **HH:MM:SS timestamps on tool-use headers** - each tool call (Bash, Edit, Write, Read, Grep, Glob, etc.) shows when it was executed
> - **Periodic statusLine auto-refresh** - adds `statusLine.updateInterval` setting (seconds) so the status bar updates on a timer, not just on events
>
> The binary is called `claude-ts`. Everything else is stock Claude Code.

### Timestamp patches

Two regex patches find stable structural patterns in the minified code and inject timestamp elements:

1. **Individual tool headers** (Bash, Edit, Write, etc.) - adds a timestamp to the right side of each tool-use header
2. **Collapsed read/search groups** (Read, Grep, Glob summaries) - wraps the summary row and appends a timestamp

### Periodic statusLine

Stock Claude Code's statusLine only updates on events (new messages, permission changes). This fork adds:

- **Patch 3a**: extends the Zod settings schema to accept `updateInterval` (number, optional)
- **Patch 3b**: injects a `setInterval` in the statusLine component's mount effect

```json
{
  "statusLine": {
    "type": "command",
    "command": "date '+%H:%M:%S'",
    "updateInterval": 5
  }
}
```

### Install (Nix flake)

```nix
# flake input
claude-ts.url = "gitlab:sophronesis/claude-code-ts";

# in packages
inputs.claude-ts.packages.${system}.default
```

Quick install (requires [nix](https://nixos.org/download/)):
```bash
nix profile install gitlab:sophronesis/claude-code-ts
claude-ts
```

Or build without installing:
```bash
nix build gitlab:sophronesis/claude-code-ts
./result/bin/claude-ts
```

---

*Below is the original Claude Code README.*

---

# Claude Code

![](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![npm]](https://www.npmjs.com/package/@anthropic-ai/claude-code)

[npm]: https://img.shields.io/npm/v/@anthropic-ai/claude-code.svg?style=flat-square

Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster by executing routine tasks, explaining complex code, and handling git workflows -- all through natural language commands. Use it in your terminal, IDE, or tag @claude on Github.

**Learn more in the [official documentation](https://code.claude.com/docs/en/overview)**.

<img src="./demo.gif" />

## Get started
> [!NOTE]
> Installation via npm is deprecated. Use one of the recommended methods below.

For more installation options, uninstall steps, and troubleshooting, see the [setup documentation](https://code.claude.com/docs/en/setup).

1. Install Claude Code:

    **MacOS/Linux (Recommended):**
    ```bash
    curl -fsSL https://claude.ai/install.sh | bash
    ```

    **Homebrew (MacOS/Linux):**
    ```bash
    brew install --cask claude-code
    ```

    **Windows (Recommended):**
    ```powershell
    irm https://claude.ai/install.ps1 | iex
    ```

    **WinGet (Windows):**
    ```powershell
    winget install Anthropic.ClaudeCode
    ```

    **NPM (Deprecated):**
    ```bash
    npm install -g @anthropic-ai/claude-code
    ```

2. Navigate to your project directory and run `claude`.

## Plugins

This repository includes several Claude Code plugins that extend functionality with custom commands and agents. See the [plugins directory](./plugins/README.md) for detailed documentation on available plugins.

## Reporting Bugs

We welcome your feedback. Use the `/bug` command to report issues directly within Claude Code, or file a [GitHub issue](https://github.com/anthropics/claude-code/issues).

## Connect on Discord

Join the [Claude Developers Discord](https://anthropic.com/discord) to connect with other developers using Claude Code. Get help, share feedback, and discuss your projects with the community.

## Data collection, usage, and retention

When you use Claude Code, we collect feedback, which includes usage data (such as code acceptance or rejections), associated conversation data, and user feedback submitted via the `/bug` command.

### How we use your data

See our [data usage policies](https://code.claude.com/docs/en/data-usage).

### Privacy safeguards

We have implemented several safeguards to protect your data, including limited retention periods for sensitive information, restricted access to user session data, and clear policies against using feedback for model training.

For full details, please review our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) and [Privacy Policy](https://www.anthropic.com/legal/privacy).
