# CLAUDE.md (porchfest-2026)

Project-level working agreements for the Somerville PorchFest 2026 map.

## Never commit untested changes

Do not commit until the change has been verified in the browser preview. For print/CSS changes, simulate the print layout using injected styles in `preview_eval` and take a screenshot to confirm the layout before committing. For JS/filter logic, run `npm test` (Playwright) first.

## Dev server

Start with the "Static Site" launch config (python3 http.server on port 3000). Use `preview_start` / `preview_eval` / `preview_screenshot` to verify changes in the preview pane.

## Testing

Run `npm test` to execute the Playwright suite. All tests must pass before committing changes to map behavior, filters, or zoom.

## Verify the test tests the right thing

A passing test only matters if it would have failed against the broken code. Before trusting a test as evidence a fix works:

1. **Reproduce the bug under the test conditions first.** If the test passes against the broken version too, the test isn't testing what you think — fix the test before fixing the code.
2. **Watch for "fake" event triggers.** Dispatching a synthetic event (e.g. `window.dispatchEvent(new Event('beforeprint'))`) only fires the listener; it does NOT activate `@media print` CSS or switch the rendering viewport to the print page. For print, use Playwright's `page.emulateMedia({ media: 'print' })` and a viewport sized to the print page (letter @ 0.5in margins ≈ 720×960 CSS px) so the layout actually reflects what gets printed.
3. **Test outcomes, not invocations.** "The handler ran" or "a value changed" is not the same as "the user-visible result is correct." Prefer assertions on the rendered geometry, visible content, or pixel output over assertions on intermediate state.

## Commits

Atomic commits — one logical change per commit. Write the commit message in imperative mood, explain the *why* in the body if non-obvious.
