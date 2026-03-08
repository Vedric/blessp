# Contributing to Blessp

This guide covers the conventions and workflow for contributing to the project.

## Table of Contents

- [Branch Naming Convention](#branch-naming-convention)
- [Branch Workflow](#branch-workflow)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Code Review Guidelines](#code-review-guidelines)
- [Testing Requirements](#testing-requirements)
- [Code Style](#code-style)
- [Security Checklist](#security-checklist)

## Branch Naming Convention

All branches must follow this naming pattern:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New functionality | `feature/add-wishlist` |
| `fix/` | Bug fixes | `fix/42-cart-total-calculation` |
| `refactor/` | Code restructuring | `refactor/extract-order-service` |
| `perf/` | Performance improvements | `perf/batch-product-queries` |
| `chore/` | Maintenance tasks | `chore/upgrade-phpmailer` |
| `docs/` | Documentation only | `docs/update-api-endpoints` |

Include the issue number when applicable: `fix/42-cart-total-calculation`.

Use lowercase with hyphens. Keep names short but descriptive.

## Branch Workflow

We follow a branching model with two long-lived branches:

```
main (production-ready releases)
 └── develop (integration branch)
      ├── feature/add-wishlist
      ├── fix/42-cart-total
      └── refactor/extract-order-service
```

1. **`main`** contains the latest stable release. Merging to main triggers a GitHub release.
2. **`develop`** is the integration branch where features are merged and tested together.
3. **Feature branches** are created from `develop` and merged back via pull request.
4. When `develop` is stable, it is merged into `main` to cut a release.

### Getting Started

```bash
# Start from the latest develop
git checkout develop
git pull origin develop

# Create your branch
git checkout -b feature/my-new-feature

# Work, commit, push
git add <files>
git commit -m "feat(shop): add product filtering by category"
git push origin feature/my-new-feature

# Open a Pull Request targeting develop
```

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/) for a clear, consistent history.

### Format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `docs` | Documentation changes |
| `style` | Formatting, whitespace (no logic change) |
| `chore` | Build process, dependency updates |
| `ci` | CI/CD configuration changes |
| `revert` | Reverts a previous commit |

### Examples

```
feat(cart): add quantity selector to cart items

fix(checkout): correct tax calculation for international orders

refactor(auth): simplify session validation logic

perf(orders): replace N+1 queries with batch IN() lookup

docs(readme): add installation prerequisites
```

### Rules

- Use **imperative present tense**: "add" not "added" or "adds"
- Keep the summary under **72 characters**
- Use the body to explain **why**, not what
- Do not use " - " or " — " as inline separators (use commas, colons, or parentheses)
- Reference issues in the footer: `Refs #42` or `Closes #42`

## Pull Request Process

1. Create a branch from `develop` following the naming convention
2. Make your changes in focused, logical commits
3. Ensure all CI checks pass locally before pushing
4. Push your branch and open a PR targeting `develop`
5. Fill out the PR description: what changed, why, and how to test
6. Request a review from at least one team member
7. Address any review feedback
8. Once approved and CI is green, squash-merge the PR

### PR Guidelines

- **One logical change per PR.** Large changes should be broken into smaller PRs.
- **Keep PRs small.** Aim for under 400 lines changed when possible.
- **Include context.** Link the related issue, explain the reasoning.
- **Rebase onto `develop`** before requesting review to avoid merge conflicts.

## Code Review Guidelines

When reviewing a pull request, check for:

- **Correctness**: Does the code do what it claims?
- **Security**: No SQL injection, no hardcoded secrets, proper input validation
- **Readability**: Is the code clear? Are variable names descriptive?
- **Architecture**: Does it follow the project structure and patterns?
- **Performance**: Are there unnecessary queries or N+1 loops?
- **Testing**: Are edge cases covered?

### Review Etiquette

- Be constructive and specific in feedback
- Approve when satisfied; request changes when blockers exist
- Distinguish between blocking issues and suggestions

## Testing Requirements

The project uses **PHPUnit 10.5** with three test suites.

### Running Tests

```bash
# All tests
vendor/bin/phpunit

# Unit tests only (fast, no database)
vendor/bin/phpunit --testsuite unit

# Integration tests (requires PostgreSQL)
DB_DSN="pgsql:host=127.0.0.1;port=5432;dbname=blessp_test" \
  vendor/bin/phpunit --testsuite integration

# E2E tests (requires PostgreSQL)
DB_DSN="pgsql:host=127.0.0.1;port=5432;dbname=blessp_test" \
  vendor/bin/phpunit --testsuite e2e
```

### Static Analysis

PHPStan runs at level 5 on all source files:

```bash
vendor/bin/phpstan analyse
```

### What To Test

- All new features should include unit tests
- Database queries should have integration tests
- Test edge cases: empty inputs, invalid data, boundary values
- Existing tests must not break

### CI Pipeline

The CI pipeline runs automatically on every PR to `develop` or `main`:

1. PHP syntax lint
2. PHPStan static analysis (level 5)
3. Unit tests
4. Integration tests (PostgreSQL 16)
5. E2E tests
6. Composer security audit

All checks must pass before a PR can be merged.

## Code Style

- Use **4 spaces** for indentation (no tabs)
- Follow **PSR-12** coding style where applicable
- Use **parameterized queries** for all database interactions (never concatenate user input)
- Guard shared function definitions with `function_exists()` to prevent redefinition
- Keep functions focused and short
- Comment the **why**, not the **what**
- Remove debug statements (`var_dump`, `print_r`) before committing
- Use the structured logger (`logInfo`, `logError`, etc.) instead of `error_log`

## Security Checklist

Before submitting a PR, verify:

- [ ] All SQL queries use parameterized placeholders (`$1`, `:param`), never string concatenation
- [ ] User input is validated with appropriate length limits
- [ ] No secrets, passwords, or API keys are hardcoded
- [ ] POST endpoints are protected by CSRF validation
- [ ] Sensitive data is not exposed in API responses or logs
- [ ] Authentication checks are present on endpoints that require them
- [ ] Error responses do not leak internal details (SQL errors, stack traces)

## Questions?

If you have questions or need help, open an issue or reach out to the team.
