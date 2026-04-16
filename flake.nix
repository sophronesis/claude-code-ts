{
  description = "Claude Code with timestamps on tool use blocks";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      lib = nixpkgs.lib;
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = lib.genAttrs supportedSystems;
    in
    {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs {
            inherit system;
            config.allowUnfree = true;
          };
        in
        {
          default = self.packages.${system}.claude-ts;

          claude-ts = pkgs.buildNpmPackage {
            pname = "claude-ts";
            version = "2.1.111";

            src = pkgs.fetchzip {
              url = "https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-2.1.111.tgz";
              hash = "sha256-K3qhZXVJ2DIKv7YL9f/CHkuUYnK0lkIR1wjEa+xeSCk=";
            };

            npmDepsHash = "sha256-6f68qUMnDk6tn+qypVi8bPtNrxbtcf15tHrgtlhEaK4=";

            strictDeps = true;
            dontNpmBuild = true;
            env.AUTHORIZED = "1";

            postPatch = ''
              cp ${./package-lock.json} package-lock.json
              substituteInPlace cli.js \
                --replace-fail '#!/bin/sh' '#!/usr/bin/env sh'
            '';

            postInstall = ''
              wrapProgram $out/bin/claude \
                --set DISABLE_AUTOUPDATER 1 \
                --set-default FORCE_AUTOUPDATE_PLUGINS 1 \
                --set DISABLE_INSTALLATION_CHECKS 1 \
                --unset DEV \
                --prefix PATH : ${
                  lib.makeBinPath (
                    [ pkgs.procps ]
                    ++ lib.optionals pkgs.stdenv.hostPlatform.isLinux [
                      pkgs.bubblewrap
                      pkgs.socat
                    ]
                  )
                }
            '';

            postFixup = ''
              # Patch cli.js to add timestamps on tool use headers
              ${pkgs.nodejs}/bin/node ${./patch-timestamps.js} \
                $out/lib/node_modules/@anthropic-ai/claude-code/cli.js

              # Add claude-ts binary alias
              ln -s $out/bin/claude $out/bin/claude-ts
            '';

            meta = {
              description = "Claude Code with timestamps on tool use blocks";
              homepage = "https://github.com/anthropics/claude-code";
              license = lib.licenses.unfree;
              mainProgram = "claude-ts";
            };
          };
        }
      );

      # Overlay for use in NixOS configs: add claude-ts to pkgs
      overlays.default = final: prev: {
        claude-ts = self.packages.${final.system}.claude-ts;
      };
    };
}
