# Codeberg Release Manager Agent

> Handles version bumps, changelog updates, tagging, and Codeberg releases for mcp-context-provider.

## Prerequisites

Before running this agent, ensure:
- Working directory is clean (`git status` shows no changes)
- You are on the `main` branch
- All tests pass (`npm test`)
- Build succeeds (`npm run build`)

## Workflow

### Step 1: Determine Version Bump

Ask the user what type of release this is, or infer from recent changes:

| Change Type | Bump | Example |
|------------|------|---------|
| Breaking MCP API change | MAJOR | 2.0.0 → 3.0.0 |
| New feature / MCP tool | MINOR | 2.1.0 → 2.2.0 |
| Bug fix / docs / deps | PATCH | 2.1.0 → 2.1.1 |
| Pre-release increment | PRE | 2.0.0-alpha.3 → 2.0.0-alpha.4 |
| Phase transition | PRE | 2.0.0-alpha.4 → 2.0.0-beta.1 |

For pre-release versions, determine if this is:
- **Increment**: alpha.3 → alpha.4 (default for ongoing work)
- **Phase transition**: alpha → beta, beta → rc, rc → stable (explicit user decision)

### Step 2: Validate

```bash
# Ensure tests pass
npm test

# Ensure build succeeds
npm run build

# Check current version
node -e "console.log(require('./package.json').version)"
cat VERSION
```

If tests or build fail, **stop and report**. Do not proceed with a broken release.

### Step 3: Update Version in Both Files

**package.json** — update the `"version"` field:
```bash
npm version <new-version> --no-git-tag-version
```

**VERSION** — update plain text file:
```bash
echo -n "<new-version>" > VERSION
```

### Step 4: Update CHANGELOG.md

1. Rename `[Unreleased]` to `[<new-version>] - <YYYY-MM-DD>`
2. Add a new empty `[Unreleased]` section above it
3. If there is no `[Unreleased]` section, create one from recent commits since last tag

CHANGELOG entry format:
```markdown
## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...
```

### Step 5: Commit and Tag

```bash
git add package.json VERSION CHANGELOG.md
git commit -m "release: vX.Y.Z — <one-line summary>"
git tag vX.Y.Z
```

Commit message format: `release: v<version> — <brief description>`

### Step 6: Push

```bash
git push origin main
git push origin vX.Y.Z
```

The tag push runs the CI pipeline (`.woodpecker.yml`): lint, build, test, JSON
validation. It does not create the release — that is step 7 below.

Note: Woodpecker must be enabled for the repository at `ci.codeberg.org/repos/add`
for any of this to run. If the commit shows no status checks, it is not wired up
and the gates only ran wherever you ran them by hand — say so rather than
reporting the pipeline as triggered.

### Step 7: Create Codeberg Release (via Forgejo API)

Install `tea` (Forgejo CLI) if not available:
```bash
# macOS
brew install tea
```

Then create the release:

```bash
# Authentication
tea login add

# Create release
tea release create \
  --title "vX.Y.Z" \
  --notes "$(git tag -l --format='%(contents)' vX.Y.Z)" \
  --tag vX.Y.Z \
  vX.Y.Z
```

Use `--prerelease` flag for any version containing a pre-release identifier:
```bash
tea release create \
  --title "vX.Y.Z" \
  --tag vX.Y.Z \
  --prerelease
```

## Post-Release Verification

```bash
# Verify tag exists
git tag -l "vX.Y.Z"

# Verify version files match
node -e "console.log(require('./package.json').version)"
cat VERSION

# Verify Codeberg release
tea release list
```

## Rules

- **Never skip tests** — a failing test suite means no release
- **Never skip build** — TypeScript must compile cleanly
- **Two-file sync** — package.json and VERSION must always match
- **Main branch only** — no release branches for this project
- **Tag triggers CI** — the `v*` tag push triggers the CI pipeline
- **Pre-release flag** — always mark alpha/beta/rc as pre-release on Codeberg
- **Clean working directory** — commit or stash all changes before starting
