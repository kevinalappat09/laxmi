---
name: laxmi-ui
description: Build or modify Laxmi renderer UI using the shared component library, tokens, stories, accessibility checks, and frontend verification.
---

# Laxmi UI workflow

1. Read `renderer/DESIGN.md` and inspect existing exports in `renderer/src/components/ui/index.ts`.
2. Compose an existing primitive or pattern before adding a new one.
3. If a primitive is missing, add it inside `components/ui`, wrap Radix behavior, and expose a product-level API.
4. Style only with semantic tokens. Add a token before repeating a visual literal.
5. Preserve controlled state conventions, focus behavior, accessible names, and both themes.
6. Add or update its Storybook story and focused interaction test.
7. Run `npm run verify:frontend`, then request review from `ui-design-reviewer` for substantial UI work.
