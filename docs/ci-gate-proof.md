# CI gate proof (founder-os#8337 R1)

Docs-only no-op change. If every check on this PR is green with no admin
override needed for CHECKS, the "Playwright fails on every run" era is over
(root cause: macOS AirPlay Receiver owned port 5000 on the self-hosted runner).
