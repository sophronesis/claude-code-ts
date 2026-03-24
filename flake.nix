{
  description = "Claude Code with timestamps on tool use blocks";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
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

          claude-ts = pkgs.claude-code.overrideAttrs (oldAttrs: {
            pname = "claude-ts";

            postFixup = (oldAttrs.postFixup or "") + ''
              # Patch cli.js to add timestamps on tool use headers
              ${pkgs.nodejs}/bin/node ${./patch-timestamps.js} \
                $out/lib/node_modules/@anthropic-ai/claude-code/cli.js

              # Add claude-ts binary alias
              ln -s $out/bin/claude $out/bin/claude-ts
            '';

            meta = oldAttrs.meta // {
              description = "Claude Code with timestamps on tool use blocks";
              mainProgram = "claude-ts";
            };
          });
        }
      );

      # Overlay for use in NixOS configs: add claude-ts to pkgs
      overlays.default = final: prev: {
        claude-ts = self.packages.${final.system}.claude-ts;
      };
    };
}
