# BookRadar 📡

Search Japanese public libraries for book availability, powered by [Calil](https://calil.jp/).
Type a title or author, pick a book, and see which of your local libraries have it — no sign-up, no server, no build step.

---

## Features

- **Search by title or author** — via the Google Books API (optional API key for reliability, see below)
- **Live availability** — checks your chosen library system(s) via Calil and polls until results are ready
- **Default library** — set your prefecture/city once; every search checks that library system automatically
- **Multiple systems per city** — some cities have more than one library system (ward library, university libraries, etc.) — pick which ones to include
- **Direct links** — each library and reservation link goes straight to the library's own catalog/reserve page
- **Clear button** — reset the search field and results in one tap to start a new search
- **Light & dark** — follows your system colour scheme
- **No dependencies** — pure HTML / CSS / JavaScript, runs entirely client-side

---

## Usage

1. Open `index.html` (or the deployed site)
2. Tap **⚙️** and:
   - Paste your Calil API key ([get one free here](https://calil.jp/api/dashboard/)) and save it
   - Optionally paste a Google Books API key ([get one free here](https://console.cloud.google.com/apis/library/books.googleapis.com)) for reliable search (see below)
   - Pick your prefecture and city, choose which library system(s) to include, and save as default
3. Search for a book by title or author
4. Tap a result to see availability across your default library system(s)

---

## Technical notes

- **Book search**: [Google Books API](https://developers.google.com/books) (`volumes` endpoint) — CORS-enabled. Coverage of obscure/library-only Japanese titles is imperfect since it's a general book catalog, not a JP library-specific one.
- **Google Books quota**: keyless requests share a *global* anonymous quota across every app calling the API without a key — it can return `429` due to unrelated traffic elsewhere, independent of your own usage (confirmed: identical `429` reproduced from two unrelated networks on the same day). Adding a free Google Cloud API key in settings gives the app its own private quota and avoids this.
- **Availability & library data**: [Calil API](https://calil.jp/doc/api.html) `/check` and `/library` endpoints. Despite the published docs only mentioning JSONP, both endpoints return real `Access-Control-Allow-Origin: *` CORS headers when called with `callback=no`, so the whole app runs via plain `fetch()` — no proxy or JSONP needed.
- **Async polling**: `/check` can return `continue: 1` while Calil queries the library system live. The app polls the same endpoint with the returned `session` id every 2 seconds (Calil's documented minimum interval) until `continue: 0` or ~30 seconds elapse.
- **API key storage**: your Calil `appkey` is entered in the settings panel (as a password-masked field, with a one-tap "削除" to clear it) and stored only in the browser's `localStorage` — it is never committed to this repo. Because there's no backend, the key is still visible in outgoing network requests from your browser (unavoidable without a server-side proxy, which was ruled out for this app); Calil's rate limit (1,000 requests/hour) is tracked per key+IP.
- **Attribution**: per Calil's terms, every library name and reservation link is linked back to the corresponding `calil.jp` book/library page.
- **City → library system resolution**: selecting a city calls Calil's `/library` endpoint, groups the returned libraries by `systemid`, and lets you opt in/out per system (university libraries are unchecked by default).
- **Security hardening**: all externally-sourced text (book titles, library/system names, reservation URLs) is rendered via `textContent`/DOM construction rather than `innerHTML`, so it can never be interpreted as markup. Reservation URLs are further validated to be `http(s)://` before being used as a link target, rejecting `javascript:`/`data:` and similar schemes. A `Content-Security-Policy` meta tag restricts network/script/style/image origins to only what the app needs (`self`, `api.calil.jp`, `www.googleapis.com`, Google Books thumbnail hosts).
- **Accessibility**: search results are real `<button>` elements (keyboard/screen-reader operable, not just clickable `<li>`s). The settings panel is a proper `role="dialog"` with focus moved in on open, restored on close, Tab trapped inside, and Escape to close.

---

## Development

```bash
# No install needed — just open the file
open index.html
```

Files:
```
index.html   # App shell + settings modal
style.css    # All styles (CSS variables, responsive, light/dark)
script.js    # App logic (search, Calil calls, polling, rendering)
```

---

## Change Log

### v1.3.0 — 2026-07-22 — hardening from external code review

Security:
- Replaced `innerHTML` rendering of book titles, library/system names, and reservation links with safe DOM construction (`textContent` + `createElement`) — external API data could otherwise inject markup
- Reservation URLs are validated to be `http:`/`https:` before use, rejecting `javascript:`/`data:` schemes
- Added a `Content-Security-Policy` restricting script/style/connect/img origins to only what the app needs
- API key fields are now password-masked (`type="password"`), with a "削除" button to clear a saved key
- `br_default` in `localStorage` is now defensively parsed — a corrupted/malformed value is discarded instead of crashing the app on load

Accessibility / usability:
- Search results are now real `<button>` elements — keyboard/screen-reader operable, not just clickable list items
- Settings modal is a proper `role="dialog"`: focus moves in on open and is restored on close, Tab is trapped inside, Escape closes it
- Saving an API key or default library now shows a brief inline confirmation instead of saving silently
- The search button disables while a search is in flight, preventing duplicate overlapping requests
- Selecting a different book while a previous availability check is still polling now cancels the stale request (via `AbortController`) instead of racing it
- Fixed the search row on narrow screens (input + 検索 + クリア) to wrap into two rows instead of squeezing all three into one

Not implemented: moving API keys behind a server-side proxy — this app is deliberately client-side-only (no hosting account available for a proxy), a tradeoff already made earlier; the mitigations above (masked fields, clear-key button, CSP) address the practical risk within that constraint.

### v1.2.0 — 2026-07-22
- Add a "クリア" (Clear) button next to search that resets the search field, results, and availability panel for a fresh search

### v1.1.2 — 2026-07-22
- Selecting a book now hides the search results list, showing only the 蔵書状況 (availability) panel instead of both at once

### v1.1.1 — 2026-07-22
- Show the current version number in the footer, so you can confirm the deployed site has actually updated (GitHub Pages caches assets for a while after each release)

### v1.1.0 — 2026-07-22
- Add optional Google Books API key setting to avoid the shared anonymous-quota `429` errors that keyless search can hit
- Clearer error messages distinguishing quota issues from other search failures

### v1.0.0 — 2026-07-22
- Initial release
- Title/author search via Google Books
- Default library system setup (prefecture → city → systemid selection)
- Availability check with async polling via Calil
- Attribution links per Calil's terms of use
- Responsive layout with light/dark support
