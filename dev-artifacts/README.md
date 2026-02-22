## Dev/Test Artifacts

This folder stores local development and browser test artifacts so they stay separate from the app source files.

### Included

- `test-browser.js`: End-to-end smoke test script for the weather UI.
- `test-globe-pin.js`: Focused test for globe pin interactions.
- `test-results.json`: Latest captured test run output.
- `package.json`: Test-only dependency manifest (`puppeteer`).
- `test-screenshots/`: Output directory for screenshots captured by tests.

### Run

From this folder:

```bash
npm install
node test-browser.js
node test-globe-pin.js
```
