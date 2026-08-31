# Form delivery observability test

## Purpose

This test compares ways to deliver the complete grievance-form catalogue to a browser. It measures the real Vercel response, browser processing, search-index construction, local storage, and offline read cost. Option values remain in every form payload but are excluded from the search index.

## Payloads under test

The diagnostics branch contains these candidates:

1. The current raw `forms.json` file.
2. One cleaned file with null values and capture-only metadata removed.
3. One compact, frontend-ready file.
4. The same compact data split into one file per authority. The page tests one, two, and four concurrent downloads.

Run `pnpm catalogue:diagnostics:prepare` after changing the catalogue. This regenerates the files under `public/form-diagnostics`.

## Browser measurements

Open `/diagnostics/forms` on the deployed Vercel preview. Run one strategy at a time, especially on low-memory phones. Reload the page between tests when comparing memory.

The page records:

- Resource count, HTTP transfer size, encoded body size, and decoded body size when the browser exposes them.
- Download, JSON parsing, normalization, search-index construction, sample search, IndexedDB write, and IndexedDB read times.
- JavaScript heap samples in Chromium when `performance.memory` is available.
- Main-thread long tasks.
- Vercel cache and content-encoding response headers.
- Browser, device-memory, CPU-core, language, and connection information exposed by the browser.

Each run stores its downloaded JSON in IndexedDB, reads and parses one stored resource, then removes the test records. This measures the offline read path without leaving hundreds of megabytes on the device.

Use **Copy JSON** or **Download JSON** after finishing the tests. The page does not upload results.

## Network checks with curl

Browser timings are the main evidence. Curl provides a separate check of Vercel delivery and compression:

```powershell
curl.exe --http2 -H "Accept-Encoding: br" -o NUL -sS -D headers.txt -w "HTTP: %{http_version}`nDownloaded: %{size_download}`nHeaders: %{size_header}`nTTFB: %{time_starttransfer}s`nTotal: %{time_total}s`n" "https://DEPLOYMENT_URL/form-diagnostics/compact-single.json"
```

Repeat with `identity`, `gzip`, and `br`. Run each request several times and compare medians. Inspect `content-encoding`, `cache-control`, `age`, and `x-vercel-cache` in `headers.txt`.

## Test procedure

Use the same Vercel deployment for every device. Record one run on desktop Chrome, one modern phone, and the lowest-memory Android phone available. On the low-memory phone, also use the slowest real connection available or Chrome's network throttling.

For each strategy:

1. Reload the diagnostics page.
2. Close other browser tabs where practical.
3. Run the strategy once and wait for completion.
4. Export the JSON before moving to the next strategy.
5. Confirm that the tab did not reload or get killed during indexing.

The final choice should use median timings across repeated runs. A strategy is unsuitable if the low-memory phone reloads the tab, indexing causes long freezes, or offline retrieval requires parsing the entire catalogue just to open one authority.

## Limits

Browser heap reporting is unavailable in some browsers and remains an estimate when available. A desktop throttle cannot reproduce Android memory pressure. The real low-memory Android run is therefore the deciding stability test.
