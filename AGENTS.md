# Laxmi engineering contract

## Frontend

- Read `renderer/DESIGN.md` before changing renderer UI.
- Invoke the project skill at `.cursor/skills/laxmi-ui/SKILL.md` for frontend work.
- Reuse exports from `renderer/src/components/ui`; do not create page-local lookalikes.
- Radix packages may only be imported inside `renderer/src/components/ui`.
- Use design tokens from `renderer/src/styles`; do not add literal colors, radii, or shadows in feature CSS.
- Preserve accessibility, keyboard behavior, light/dark themes, and the existing information architecture.

## Verification

- Run `npm run verify:frontend` for renderer changes.
- Run `npm run verify` for cross-process or release changes.
- Ask the UI design reviewer to inspect substantial frontend changes before handoff.
