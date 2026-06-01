# CLAUDE.md (porchfest-2026)

Project-level working agreements for the Somerville PorchFest 2026 map.

## Never commit untested changes

Do not commit until the change has been verified in the browser preview. For print/CSS changes, simulate the print layout using injected styles in `preview_eval` and take a screenshot to confirm the layout before committing. For JS/filter logic, run `npm test` (Playwright) first.

## Dev server

Start with the "Static Site" launch config (python3 http.server on port 3000). Use `preview_start` / `preview_eval` / `preview_screenshot` to verify changes in the preview pane.

## Testing

Run `npm test` to execute the Playwright suite in `tests/map.spec.js`. All 12 tests must pass before committing changes to map behavior, filters, or zoom.

## Commits

Atomic commits — one logical change per commit. Write the commit message in imperative mood, explain the *why* in the body if non-obvious.
