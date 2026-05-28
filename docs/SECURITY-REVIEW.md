# Security Review

## Review Date: 2026-05-28

## Findings

### F-001: GitHub Actions Not Pinned to SHA Digests

**Severity**: High
**Status**: Fixed
**Description**: GitHub Actions were referenced by mutable tags (e.g., `v4`) instead of immutable SHA digests. This allows supply chain attacks if a tag is moved to point to malicious code.

**Fix**: All GitHub Actions in `.github/workflows/ci.yml` are now pinned to full SHA digests:
- `actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5` (v4)
- `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020` (v4)
- `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02` (v4)

**Verification**: Review `.github/workflows/ci.yml` to confirm all `uses:` directives reference SHA digests with version comments.

### F-002: No Dependency Audit in CI

**Severity**: Medium
**Status**: Fixed
**Description**: CI pipeline did not include dependency vulnerability scanning. Known vulnerabilities in dependencies could be deployed without detection.

**Fix**: Added `npm audit --omit=dev` step in CI pipeline (`jobs.audit`). Runs on every PR and push to main.

**Verification**: Review `.github/workflows/ci.yml` `audit` job configuration.

### F-003: Lock File Not Committed

**Severity**: Medium
**Status**: Fixed
**Description**: `package-lock.json` was not tracked in version control, leading to non-deterministic dependency resolution across environments.

**Fix**: Updated `.gitignore` to ensure `package-lock.json` is tracked. Lock file is committed to the repository.

**Verification**: Run `git status` to confirm `package-lock.json` is tracked.

### F-004: No Branch Protection

**Severity**: High
**Status**: Pending (Requires GitHub Configuration)
**Description**: Main branch has no protection rules. Force pushes and direct commits without review are possible.

**Required Configuration** (via GitHub Settings or API):
1. Require pull request reviews before merging
2. Require status checks to pass (lint, test, build)
3. Require branches to be up to date before merging
4. Prevent force pushes
5. Prevent branch deletion

**Action**: Configure branch protection rules in GitHub repository settings after initial commit and CI workflow is active.

### F-005: No Automated Dependency Updates

**Severity**: Low
**Status**: Fixed
**Description**: Dependencies were manually updated, increasing risk of missing security patches.

**Fix**: Configured Dependabot in `.github/dependabot.yml`:
- Weekly npm dependency updates
- Weekly GitHub Actions updates
- Auto-labeled as `dependencies`

**Verification**: After pushing to GitHub, verify Dependabot PRs are created.

## Recommendations

1. **Enable GitHub Advanced Security** for code scanning and secret scanning
2. **Configure CODEOWNERS** file for automatic review assignments
3. **Add security policy** (SECURITY.md) for vulnerability reporting
4. **Enable commit signing** for verified commits
5. **Review Dependabot alerts** regularly and merge security patches promptly
