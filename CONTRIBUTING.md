# Contributing

## Prerequisites

- Node.js 20+ and `pnpm` (the workspace pins `pnpm@10.33.0`)
- Foundry (`forge`, `cast`, `anvil`) - install via [getfoundry.sh](https://getfoundry.sh)
- `gitleaks` - install via `brew install gitleaks` (macOS) or [the project releases](https://github.com/gitleaks/gitleaks/releases)

## Setup

```bash
pnpm install
```

`pnpm install` runs `lefthook install` (via the root `prepare` script) and wires up the git hooks.

## Git hooks

The repo uses [lefthook](https://github.com/evilmartians/lefthook) (config in `lefthook.yml`):

- **pre-commit**
  - `gitleaks protect --staged` blocks any staged file that contains a secret
  - `forge fmt --check` runs only when Solidity files in `packages/protokoll` are staged
- **commit-msg**
  - validates the subject starts with a conventional prefix: `feat | fix | chore | docs | test | refactor | style | ci | perf | build | revert`, optionally followed by `(scope)` and `!` for breaking changes

If a hook ever fires incorrectly, you can bypass with `git commit --no-verify`. Use sparingly; CI runs the same checks.

## Tests

```bash
pnpm test          # all packages
forge test         # contracts only
```

## Pull requests

PRs target `main`. The repo uses the template in `.github/PULL_REQUEST_TEMPLATE.md`.
