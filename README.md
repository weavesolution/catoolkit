# CA Financial Toolkit (v1.1.0)

Mobile-first, installable, offline PWA for credit appraisal and financial analysis.

## Calculators (18)
**Banking & Credit:** DSCR · Working Capital (Turnover / Operating cycle) · MPBF (Tandon I, II, III) · Drawing Power · TOL/TNW · Project Cost & Means of Finance · FACR
**Investment Appraisal:** IRR & MIRR · XIRR · NPV, PI & Payback · CAGR
**Loans & Interest:** EMI & Amortisation · Loan Eligibility (FOIR/LTV) · FD & Compound Interest
**Financial Analysis:** Financial Ratios (24 ratios + balance-sheet tally) · Break-Even
**Tax & Others:** GST · Depreciation (SLM/WDV)

Every calculator shows step-by-step workings, exports to PDF and Excel (.xlsx), saves to history, and works fully offline.

## Deploy on GitHub Pages
1. Create a repository and upload **all files in the root** plus the `images` folder.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)` → Save.
3. Open `https://<username>.github.io/<repo>/` in Chrome on Android → menu ⋮ → **Install app**.

All paths are relative, so it works from any repository name.

## Google Play
Published as a Trusted Web Activity. See PLAY_STORE_GUIDE.md in the delivery package.

## Updating
After changing any file, bump `VERSION` in `sw.js` (e.g. `catk-v1.0.1`) so installed apps pick up the update. Users see an "Update" prompt.

## Files
| File | Purpose |
|---|---|
| index.html | App shell |
| privacy.html | Privacy policy (needed for Google Play) |
| styles.css | Styles (light/dark) |
| calcs.js | All calculation logic |
| export.js | PDF and Excel writers (no external libraries) |
| app.js | UI, history, settings, exports |
| sw.js | Service worker (offline cache) |
| manifest.json | PWA manifest |
| images/ | App icons |

Data (history, settings, drafts) stays in the browser's local storage on the device. Use History → Backup to export it.

