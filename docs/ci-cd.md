# CI/CD Pipeline

## Pipeline Overview

GitHub Actions-based CI/CD pipeline with security-first configuration. All actions pinned to SHA digests to prevent supply chain attacks.

## CI Workflow

Runs on: PRs and pushes to main

| Stage | Trigger | What it does |
|-------|---------|--------------|
| Security Audit | PR, push to main | `npm audit --omit=dev` - checks for dependency vulnerabilities |
| Lint | PR, push to main | TypeScript type checking (`tsc --noEmit`) |
| Test | After lint passes | Runs test suite (`vitest run`) |
| Build | After test passes | Compiles TypeScript, produces build artifacts |

### Pipeline Flow

```
audit (parallel)
lint → test → build
```

## Security Configuration

### Actions Pinned to SHA Digests

All GitHub Actions are pinned to immutable SHA digests (F-001 fix):

- `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5` (v4)
- `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (v4)
- `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02` (v4)

This prevents supply chain attacks where a tag could be moved to point to malicious code.

### Dependency Scanning

- `npm audit` runs on every CI execution
- Dependabot configured for weekly dependency updates
- Security patches are prioritized

## Branch Protection

**Required Configuration** (GitHub Settings):

1. **Require pull request reviews before merging**
   - At least 1 review required
   - Dismiss stale reviews when new commits are pushed

2. **Require status checks to pass**
   - Required checks: `Security Audit`, `Lint`, `Test`, `Build`
   - Require branches to be up to date before merging

3. **Restrictions**
   - Prevent force pushes to main
   - Prevent branch deletion
   - Include administrators in restrictions

## Environment Variables

| Variable | Where set | Purpose |
|----------|-----------|---------|
| None currently | - | - |

## Deployment Targets

- **Production**: Not yet configured
- **Staging**: Not yet configured

## Rollback Procedure

1. Identify the failing commit via GitHub Actions logs
2. Create a revert PR: `git revert <commit-hash>`
3. Ensure CI passes on revert PR
4. Merge revert PR
5. Verify main branch is stable

## Dependabot Configuration

Location: `.github/dependabot.yml`

- **npm dependencies**: Weekly updates on Monday
- **GitHub Actions**: Weekly updates on Monday
- **Auto-labeling**: `dependencies`, `chore` (npm) / `ci` (actions)
- **Commit prefix**: `chore(deps)` / `ci(deps)`

## Local Development

```bash
# Install dependencies (uses lock file)
npm ci

# Run type checking
npx tsc --noEmit

# Run tests
npm test

# Run build
npm run build

# Run all checks locally
npm ci && npx tsc --noEmit && npm test && npm run build
```
