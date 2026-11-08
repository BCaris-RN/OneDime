# GitHub Free security and release tutorial

This guide explains the setup used for OneDime and the furthest practical point on
GitHub Free. It assumes administrator access to the repository.

Menu names change occasionally. If a label differs, search GitHub Docs for the
feature name instead of guessing.

## Know which free path you have

Check the plan before changing settings:

1. Open `https://github.com/settings/billing`.
2. Look under **Subscriptions**.
3. Note whether the repository is public or private and whether it belongs to a
   personal account or an organization.

For a private repository in a personal account on GitHub Free, the useful baseline is:

| Feature | GitHub Free, private personal repository |
| --- | --- |
| Dependency graph | Available |
| Dependabot alerts | Available |
| Dependabot security updates | Available |
| Dependabot version updates | Available with `.github/dependabot.yml` |
| GitHub Actions | Available within included limits |
| Release Drafter | Available as a GitHub Action |
| Enforced branch ruleset | Not available for this private repository on Free |
| CodeQL/code scanning | Requires a public repository or Team/Enterprise Code Security |
| Secret scanning and push protection | Free public repositories; private repositories need the applicable Secret Protection plan |

GitHub Free can enforce rulesets for public repositories. Private repositories need
GitHub Pro, Team, or Enterprise for rulesets; organization-owned private repositories
also have different security entitlements than personal repositories.

Sources: [GitHub security quickstart](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository),
[ruleset availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository),
[private-repository CodeQL requirements](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/private-repository-enablement),
and [secret-scanning scope](https://docs.github.com/en/code-security/reference/secret-security/secret-scanning-scope).

## 1. Enable the free dependency protections

1. Open the repository on GitHub.
2. Select **Settings**.
3. Under **Security and quality**, open **Advanced Security**.
4. Enable **Dependency graph**.
5. Enable **Dependabot alerts**.
6. Enable **Dependabot security updates**.
7. Optionally enable **Grouped security updates** after the first alerts appear.

The dependency graph must be enabled before Dependabot can map dependencies. Alerts
report known vulnerable packages. Security updates open pull requests when GitHub has
a safe patch.

## 2. Add weekly version updates

Create `.github/dependabot.yml` on a branch, then open a pull request:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        update-types: ["minor", "patch"]
```

Change `npm` to the ecosystem you use (`pip`, `nuget`, `maven`, `docker`, and so
on). Keep one entry per ecosystem and manifest location. Dependabot reads this file
from the default branch. Security updates can work without the file, but version
updates and their schedule need it.

Source: [About `dependabot.yml`](https://docs.github.com/en/code-security/concepts/supply-chain-security/about-the-dependabot-yml-file).

## 3. Add Release Drafter without a paid plan

Release Drafter is a public GitHub Action. It prepares a draft release from merged
pull requests; it does not publish or tag the release for you.

Create `.github/release-drafter.yml`:

```yaml
name-template: 'v$RESOLVED_VERSION'
tag-template: 'v$RESOLVED_VERSION'
categories:
  - title: 'Features'
    labels: ['feature']
  - title: 'Fixes'
    labels: ['bug', 'fix']
  - title: 'Maintenance'
    labels: ['chore', 'dependencies']
change-template: '- $TITLE (#$NUMBER)'
template: |
  ## Changes
  $CHANGES
```

Create `.github/workflows/release-drafter.yml`:

```yaml
name: Release Drafter

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: read

jobs:
  update_release_draft:
    runs-on: ubuntu-latest
    steps:
      - uses: release-drafter/release-drafter@v7
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Create the labels used by the categories, or use your own labels consistently:

```text
feature
bug
fix
chore
dependencies
```

Apply labels to pull requests. After a merge to `main`, check **Releases** for the
updated draft. Review it, create the tag, and publish it manually when ready.

Source: [Release Drafter](https://github.com/release-drafter/release-drafter).

## 4. Use the existing CI workflow as your gate

If the repository already has a pull-request workflow, use its real check name. Do
not invent a required check that has never run. In OneDime the existing `Test`
workflow runs build, typecheck, unit tests, beta checks, contrast checks, and browser
checks.

For a small npm repository, a minimal starting workflow is:

```yaml
name: Test
on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
```

Open a test pull request and wait for the check to finish. Record the exact check
name shown on the pull request before trying to require it in branch protection.

## 5. Branch protection: what Free can and cannot do

For a public repository on GitHub Free:

1. Open **Settings** → **Rules** → **Rulesets**.
2. Create a branch ruleset targeting `main`.
3. Set enforcement to **Active**.
4. Require a pull request before merging.
5. Require the exact CI check name.
6. Block force pushes and restrict deletions.
7. Add bypass access only for the owner or an explicitly chosen administrator.

For a private personal repository on GitHub Free, GitHub may let you fill out the
ruleset form but show that it will not be enforced. Treat that as a plan limit, not a
successful protection rule. Keep the same process manually: work on a branch, open a
pull request, wait for CI, review it, and have the owner merge `main`.

## 6. Security features that stop at the Free private-repo boundary

### Secret scanning and push protection

For a free public repository, open **Settings** → **Advanced Security**, enable
**Secret Protection**, and turn on push protection if GitHub exposes the control. For
a private personal repository on GitHub Free, the control is unavailable. Do not test
this by pushing a real credential. If a real secret is detected, rotate it first,
then remove it from history.

### CodeQL and code scanning

For a free public repository, open **Security** → **Code scanning** → **Set up** and
choose **Default** setup. For a private repository, CodeQL requires the applicable
Team or Enterprise Code Security entitlement.

### Dependency review

Dependency review on private repositories is part of GitHub Code Security. On the
Free private path, Dependabot alerts and updates are the practical built-in baseline.

## 7. Verify the setup

Check each item in this order:

1. **Settings → Advanced Security** shows the dependency graph, Dependabot alerts,
   and Dependabot security updates enabled.
2. `.github/dependabot.yml` exists on the default branch and parses as YAML.
3. A pull request runs the repository's normal CI check.
4. **Insights → Dependency graph → Dependabot** shows the configured ecosystems after
   the first scheduled scan.
5. **Releases** shows a draft after a merge to `main`.
6. Pull requests use the labels referenced by Release Drafter.
7. The repository's plan and visibility still match the intended security boundary.

Do not merge or publish a release just because a workflow file exists. Review
Dependabot pull requests like normal code changes, run the smoke suite, and let the
repository owner approve the merge.

## The free-plan result

For a private personal repository on GitHub Free, the complete practical setup is:

- dependency graph;
- Dependabot alerts;
- Dependabot security updates;
- weekly npm and GitHub Actions version updates;
- GitHub Actions CI;
- Release Drafter drafts;
- manual pull-request review and owner-controlled merges;
- manual release tagging and publishing.

To add enforced private branch rulesets, private CodeQL, private secret scanning, or
push protection, upgrade the plan or use a repository ownership and visibility model
whose GitHub entitlement includes those features. Do not make a private repository
public solely to obtain security controls without reviewing the data and history it
contains.

### References

- [GitHub security quickstart](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository)
- [Managing security and analysis settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository)
- [Dependabot version updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-version-updates)
- [Dependabot security updates](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates)
- [Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- [Secret scanning scope](https://docs.github.com/en/code-security/reference/secret-security/secret-scanning-scope)
- [Private-repository CodeQL requirements](https://docs.github.com/en/code-security/reference/code-scanning/troubleshoot-analysis-errors/private-repository-enablement)
