# 🤝 Contributing to Blessp

Thank you for your interest in contributing to Blessp! This guide will help you get started and ensure a smooth collaboration.

---

## 📌 Table of Contents

- [Branch Naming Convention](#-branch-naming-convention)
- [Branch Workflow](#-branch-workflow)
- [Commit Message Format](#-commit-message-format)
- [Pull Request Process](#-pull-request-process)
- [Code Review Guidelines](#-code-review-guidelines)
- [Testing Requirements](#-testing-requirements)
- [Code Style](#-code-style)

---

## 🌿 Branch Naming Convention

All branches must follow this naming pattern:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New functionality | `feature/add-wishlist` |
| `fix/` | Bug fixes | `fix/cart-total-calculation` |
| `refactor/` | Code restructuring | `refactor/extract-order-service` |
| `chore/` | Maintenance tasks | `chore/upgrade-phpmailer` |
| `docs/` | Documentation only | `docs/update-api-endpoints` |

Use lowercase with hyphens. Keep branch names short but descriptive.

---

## 🔀 Branch Workflow

We follow a **branching model** with two main branches:

```
main (production-ready)
 └── develop (integration branch)
      ├── feature/add-wishlist
      ├── fix/cart-total-calculation
      └── refactor/extract-order-service
```

1. **`main`** contains the latest stable release.
2. **`develop`** is the integration branch where features are merged.
3. **Feature branches** are created from `develop` and merged back into `develop` via pull request.
4. When `develop` is stable and ready for release, it is merged into `main`.

### ⚡ Quick Start

```bash
# Start from the latest develop
git checkout develop
git pull origin develop

# Create your branch
git checkout -b feature/my-new-feature

# Work, commit, push
git add .
git commit -m "feat(shop): add product filtering by category"
git push origin feature/my-new-feature

# Open a Pull Request to develop
```

---

## 📝 Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear, consistent history.

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

docs(readme): add installation prerequisites
```

### 📏 Rules

- Use **imperative present tense**: "add" not "added" or "adds"
- Keep the summary under **72 characters**
- Use the body to explain **why**, not what
- Reference issues in the footer: `Refs #42`

---

## 🔄 Pull Request Process

1. 🌿 Create a branch from `develop` following the naming convention
2. 💻 Make your changes in focused, logical commits
3. ✅ Ensure your code passes all checks (syntax, tests)
4. 📤 Push your branch and open a PR targeting `develop`
5. 📋 Fill out the PR template completely
6. 👀 Request a review from at least one team member
7. 🔄 Address any review feedback
8. ✅ Once approved and CI is green, the PR will be merged

### PR Guidelines

- **One logical change per PR.** Large changes should be broken into smaller PRs.
- **Keep PRs small.** Aim for under 400 lines changed when possible.
- **Include context.** Link the related issue, explain the reasoning.
- **Rebase onto `develop`** before requesting review to avoid merge conflicts.

---

## 👀 Code Review Guidelines

When reviewing a pull request, check for:

- ✅ **Correctness**: Does the code do what it claims?
- 🔒 **Security**: No SQL injection, no hardcoded secrets, proper input validation
- 📖 **Readability**: Is the code clear? Are variable names descriptive?
- 🏗️ **Architecture**: Does it follow the project structure and patterns?
- ⚡ **Performance**: Are there unnecessary queries or loops?
- 🧪 **Testing**: Are edge cases covered?

### Review Etiquette

- Be constructive and specific in feedback
- Approve when satisfied; request changes when blockers exist
- Distinguish between blocking issues and suggestions

---

## 🧪 Testing Requirements

- All new features should include appropriate tests when a test framework is set up
- Existing functionality must not break (run `php -l` on all modified files)
- Test edge cases: empty inputs, invalid data, boundary values
- For database changes, verify queries work with PostgreSQL

### Quick Syntax Check

```bash
# Check all PHP files for syntax errors (excluding vendor libs)
find . -name "*.php" -not -path "./mailer/*" -not -path "./vendor/*" -exec php -l {} \;
```

---

## 🎨 Code Style

- Use **4 spaces** for indentation (no tabs)
- Follow **PSR-12** coding style where applicable
- Use **parameterized queries** for all database interactions (never concatenate user input)
- Keep functions focused and short
- Comment the **why**, not the **what**
- Remove debug statements (`var_dump`, `print_r`, `error_log`) before committing

---

## 💬 Questions?

If you have questions or need help, open an issue or reach out to the team. We appreciate every contribution, no matter how small!
