# Contributing to Zendesk File Renamer

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Code Style](#code-style)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

Be respectful and constructive. We're all here to make a useful tool.

---

## Getting Started

### Prerequisites

- Chrome or Arc browser
- Git
- A text editor (VS Code recommended)
- Basic knowledge of JavaScript and Chrome Extension APIs

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/zendesk-file-renamer.git
   cd zendesk-file-renamer
   ```

3. **Load the extension in Chrome:**
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project folder

4. **Make changes and reload:**
   - Edit files in your editor
   - Click the reload button on the extension card in `chrome://extensions`
   - Test your changes

---

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/custom-format-input` - New features
- `fix/url-parsing-edge-case` - Bug fixes
- `docs/installation-guide` - Documentation
- `refactor/message-handling` - Code improvements

### Commit Messages

Use conventional commit format:

```
type(scope): short description

Longer description if needed.
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting, no code change
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding tests
- `chore` - Maintenance tasks

Examples:
```
feat(popup): add custom format string input
fix(content): handle hash-based ticket URLs
docs(readme): add Firefox compatibility note
```

---

## Code Style

### JavaScript

- **No external dependencies** - Keep it vanilla JS
- **Use JSDoc comments** for all functions
- **Use `const` by default**, `let` when reassignment needed
- **Descriptive variable names** - `ticketId` not `tid`
- **Early returns** for guard clauses

```javascript
// Good
/**
 * Extracts ticket ID from a Zendesk URL.
 * @param {string} url - The URL to parse.
 * @returns {string|null} The ticket ID or null if not found.
 */
function extractTicketId(url) {
  if (!url) {
    return null;
  }

  const match = url.match(/\/tickets\/(\d+)/);
  return match ? match[1] : null;
}

// Avoid
function extract(u) {
  var m = u.match(/\/tickets\/(\d+)/);
  if (m) return m[1];
  else return null;
}
```

### CSS

- **Use CSS custom properties** for colors and spacing
- **BEM-like naming** - `.setting-group`, `.toggle-slider`
- **Mobile-first** - Extension popup is fixed width, but be mindful

### HTML

- **Semantic elements** where appropriate
- **Accessible** - Labels, focus states, ARIA when needed
- **No inline styles** - All styling in CSS files

---

## Submitting Changes

### Pull Request Process

1. **Update documentation** if your change affects user-facing behavior

2. **Test thoroughly:**
   - [ ] Basic renaming works
   - [ ] Settings persist
   - [ ] Multiple tabs work correctly
   - [ ] Edge cases handled

3. **Create a pull request** with:
   - Clear title describing the change
   - Description of what and why
   - Screenshots if UI changes
   - Link to related issue if applicable

4. **Respond to feedback** - Maintainers may request changes

### What We're Looking For

- **Bug fixes** - Always welcome
- **Performance improvements** - With benchmarks
- **Accessibility improvements** - Important for all users
- **Documentation** - Helps everyone
- **New features** - Discuss in an issue first

### What to Avoid

- Adding external dependencies without strong justification
- Breaking changes to settings format (migration needed)
- Features that require additional permissions
- Code without comments or documentation

---

## Reporting Issues

### Bug Reports

Include:
- Browser and version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console errors if any

### Feature Requests

Include:
- Clear description of the feature
- Use case / why it's useful
- Mockup or example if applicable

---

## Questions?

Open a discussion on GitHub or reach out to the maintainers.

Thank you for contributing!
