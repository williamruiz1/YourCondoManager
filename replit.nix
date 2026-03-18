{pkgs}: {
  deps = [
    pkgs.python312Packages.graphite-web
    pkgs.python312Packages.python-lsp-black
    pkgs.google-chrome
  ];
}
