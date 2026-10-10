# Laxmi frontend design system

Laxmi is a focused, local-first finance workspace: restrained surfaces, high-legibility financial data, and a single clear accent. Dark and light themes are equally supported.

## Architecture

- `src/styles/tokens.css` owns theme-independent typography, spacing, radii, motion, layout, and focus tokens.
- `src/styles/themes.css` owns palette primitives and semantic theme aliases.
- `src/components/ui` is the only primitive boundary. It wraps Radix behavior and exports Laxmi APIs through `index.ts`.
- Feature components and pages compose shared primitives. They do not style native controls or import Radix directly.
- Storybook is the visual contract; renderer tests are the behavior contract; `npm run check:design-system` enforces the boundary.

## Product language

- Use near-black or white semantic surfaces with subtle elevation and borders.
- Reserve the lime/blue accent for primary actions, selection, and focus.
- Use positive, negative, and transfer colors only for financial meaning.
- Prefer the shared spacing scale. Cards use `--radius-cards`; controls use `--radius-input-sm` or `--radius-general`; pills use `--radius-pill`.
- Use tabular, right-aligned presentation for comparable financial values.
- Motion is brief and functional; always preserve reduced-motion and keyboard usability.

## Component contract

- Import from `components/ui` and reuse existing variants before creating new ones.
- Shared controlled inputs use `value` / `onValueChange`; overlays use `open` / `onOpenChange`.
- Every control has an accessible name and visible focus state.
- Dialogs and popovers must trap or restore focus through the shared Radix-backed primitive.
- Shared visual components require a Storybook state and focused interaction coverage.

## Change checklist

1. Search the shared library for an existing primitive or pattern.
2. Add semantic tokens instead of repeating literal visual values.
3. Check default, hover, focus, disabled, error, and empty states as applicable.
4. Check dark/light themes and keyboard navigation.
5. Run `npm run verify:frontend`.
