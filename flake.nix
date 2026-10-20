{
  description = "Reproducible local and CI resume PDF generation";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs = { nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
    in {
      devShells.${system}.default = pkgs.mkShellNoCC {
        packages = [ pkgs.nodejs_24 pkgs.chromium ];
        PUPPETEER_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
        # Ignore host fonts: Arial must resolve identically locally and in CI.
        FONTCONFIG_FILE = pkgs.writeText "resume-fonts.conf" ''
          <?xml version="1.0"?>
          <!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
          <fontconfig>
            <dir>${pkgs.liberation_ttf}/share/fonts/truetype</dir>
            <alias><family>Arial</family><prefer><family>Liberation Sans</family></prefer></alias>
            <cachedir prefix="xdg">fontconfig</cachedir>
          </fontconfig>
        '';
      };
    };
}
