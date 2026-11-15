# GitHub Release Manager Agent

> Handles version bumps, changelog updates, tagging, and GitHub releases for mcp-context-provider.

## Prerequisites

Before running this agent, ensure:
- Working directory is clean (`git status` shows no changes)
- Local `main` is up to date with `origin/main`, and `origin` is the GitHub remote (`git remote -v`)
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

### Step 3: Create the Release Branch

Nothing is committed straight to `main`. The release commit goes through a pull request.

```bash
git switch -c release/vX.Y.Z origin/main
```

### Step 4: Update Version in Both Files

**package.json** — update the `"version"` field:
```bash
npm version <new-version> --no-git-tag-version
```

**VERSION** — update plain text file:
```bash
echo -n "<new-version>" > VERSION
```

### Step 5: Update CHANGELOG.md

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

### Step 6: Commit, Push, Open the Pull Request

```bash
git add package.json package-lock.json VERSION CHANGELOG.md
git commit -m "release: vX.Y.Z — <one-line summary>"
git push -u origin release/vX.Y.Z
gh pr create --base main --title "release: vX.Y.Z — <one-line summary>"
```

Commit message format: `release: v<version> — <brief description>`

`npm version` also rewrites the version in `package-lock.json`; stage it when it changed.

Wait for CI on the pull request (`gh pr checks <n> --watch`). Merging is the
maintainer's call: ask before merging, do not merge on a red or pending check.

### Step 7: Tag the Merge on main

The tag goes on the commit that landed on `main`, not on the branch commit. With
a squash or rebase merge those are different commits.

```bash
git switch main
git pull --ff-only origin main

# Confirm HEAD is the release commit and both version files carry the new version
git log -1 --oneline
node -e "console.log(require('./package.json').version)"
cat VERSION

git tag vX.Y.Z
git push origin vX.Y.Z
```

Push the tag to `origin` only. Mirrors receive fast-forwards of `main`, never tags.

### Step 8: Let the Workflow Create the Release

The tag push runs `.github/workflows/release.yml`: lint, build and test, then
`gh release create` with generated notes. Tags containing `-alpha`, `-beta` or
`-rc` are marked pre-release by the workflow. Do not create the release by hand
as well, the second attempt fails on the existing tag.

```bash
gh run watch "$(gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```

If the run fails, report the failing job and its log. The tag stays where it is;
do not move or delete it without asking.

No package is published: the npm publish job in `release.yml` is commented out.

## Post-Release Verification

```bash
# Verify tag exists locally and on GitHub
git tag -l "vX.Y.Z"
git ls-remote --tags origin "vX.Y.Z"

# Verify version files match
node -e "console.log(require('./package.json').version)"
cat VERSION

# Verify GitHub release
gh release view vX.Y.Z --json tagName,isPrerelease,url
```

## Rules

- **Never skip tests** — a failing test suite means no release
- **Never skip build** — TypeScript must compile cleanly
- **Two-file sync** — package.json and VERSION must always match
- **No direct commits to main** — the release commit goes through a pull request; there are no long-lived release branches
- **Tag after merge** — the tag points at the commit on `main`
- **Tag triggers the release** — the `v*` tag push runs `release.yml`, which creates the GitHub release and sets the pre-release flag
- **Clean working directory** — commit or stash all changes before starting
