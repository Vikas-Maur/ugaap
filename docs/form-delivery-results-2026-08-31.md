# Form delivery test results, 31 August 2026

## Test inputs

The browser result came from Chrome 151 on Windows 10 with 16 GB of device memory and 12 logical CPU cores. It used the Vercel preview at `https://ugaap-5dep.vercel.app/diagnostics/forms`. The normalized browser export is stored in [`results/form-delivery-windows-chrome-2026-08-31.json`](./results/form-delivery-windows-chrome-2026-08-31.json).

A separate curl pass ran from the development machine against the same deployment. That curl build supports HTTP/1.1 but not HTTP/2 or local Brotli decoding. It requested `Accept-Encoding: br` and discarded the response body, so `size_download` is the encoded network body.

## Browser results

All variants contained 6,865 forms and produced 6,865 search documents. Option values remained in the form payloads but were excluded from the search index.

| Strategy | Vercel cache | Encoded body | Decoded JSON | Download | Parse | Index | IDB read and parse | Long-task time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Raw single | MISS | 5.04 MB | 66.40 MB | 7.38 s | 106 ms | 202 ms | 197 ms | 628 ms |
| Cleaned single | MISS | 1.78 MB | 40.47 MB | 3.84 s | 72 ms | 188 ms | 269 ms | 494 ms |
| Compact single | MISS | 1.87 MB | 33.01 MB | 3.00 s | 60 ms | 185 ms | 126 ms | 445 ms |
| Compact split, sequential | MISS | 1.84 MB | 33.02 MB | 16.54 s summed | 92 ms | 1,036 ms | 8 ms | 108 ms |
| Compact split, concurrency 2 | HIT | 1.84 MB | 33.02 MB | 4.01 s summed | 78 ms | 160 ms | 7 ms | 219 ms |
| Compact split, concurrency 4 | HIT | 1.84 MB | 33.02 MB | 5.15 s summed | 62 ms | 149 ms | 5 ms | 207 ms |

The split rows report the sum of each resource's request duration. That is not wall-clock duration when requests overlap. The page must record a separate start-to-finish timer in a later test revision.

The cache states also differ. The sequential run fetched all 40 resources with `X-Vercel-Cache: MISS`. It warmed those resources before the concurrency 2 and 4 runs, which then received `HIT`. This run does not provide a clean 1-versus-2-versus-4 concurrency comparison.

## Curl results

Three warm Brotli requests were made for each single file:

| Resource | Encoded body | Header bytes per request | Median TTFB | Median total | Cache |
|---|---:|---:|---:|---:|---:|
| Raw single | 5.04 MB | 551 B | 208 ms | 4.93 s | HIT |
| Cleaned single | 1.78 MB | 560 B | 218 ms | 1.01 s | HIT |
| Compact single | 1.87 MB | 560 B | 210 ms | 1.82 s | HIT |
| Split index | 1.35 KB | 551 B | 225 ms | 226 ms | HIT |

The three total times varied noticeably. Raw took 2.66 to 5.51 seconds, cleaned took 0.89 to 1.90 seconds, and compact took 1.10 to 2.12 seconds. One run is not enough to rank files that differ by only about 100 KB.

The warm 40-resource split transferred 1,934,430 body bytes and 22,665 response-header bytes. The combined transfer was 1,957,095 bytes. Sequential HTTP/1.1 curl took 11.29 seconds wall time. Four parallel HTTP/1.1 transfers took 1.76 seconds. The parallel result shows the cost of strict sequencing, but it does not measure HTTP/2 multiplexing.

The inspected compact response used Brotli, returned `X-Vercel-Cache: HIT`, had an age of 234 seconds, and came from Vercel's `bom1` point of presence. Its cache policy was `public, max-age=0, must-revalidate`.

## What the result means

The raw file is no longer a reasonable delivery candidate. It transfers 5.04 MB and expands to 66.40 MB before JavaScript object overhead. Its browser run also produced 628 ms of long tasks and reached 363 MB of reported heap after the IndexedDB read.

The cleaned single file has the smallest single-file network body. It saves about 100 KB, or 5.5 percent, compared with compact single. That saving is too small to justify sending a raw-shaped format that the frontend must normalize. Compact single parses faster, reads from IndexedDB faster in this run, and is ready for rendering.

Compact split and compact single transfer almost the same amount. The split body is 29 KB smaller. Even after the measured curl response headers, the complete split was about 8 KB smaller than compact single. Request-byte overhead is therefore not the deciding issue.

The useful split advantage is offline access. Reading one stored authority took 5 to 8 ms, while reading and parsing the compact single file took 126 ms. Splitting also reduced long-task time because the browser handled smaller pieces. A real implementation must parse, index, store, and release each authority as it arrives. Keeping every parsed authority in one array would give up much of this memory benefit.

One authority remains a problem. `economic-affairs.json` alone is 1,344,691 encoded bytes and 21,577,757 decoded bytes. It contains about 69.5 percent of the split transfer. The authority split therefore still has one very large memory step. That authority should be divided by category or its large option lists should move into separate lazy-loaded files.

At 50 kbps, the measured Vercel Brotli bodies need approximately:

- Raw single: 14.1 minutes
- Cleaned single: 5.0 minutes
- Compact single: 5.2 minutes
- Compact split: 5.2 minutes for all authorities

Splitting cannot reduce total bandwidth. It allows progress, retries, resumable storage, and opening early authorities before the full download finishes.

## Current recommendation

Use compact authority files with two concurrent downloads. As each file arrives, build its search documents without option values, append them to the index, store the authority payload in IndexedDB, and release the parsed authority object. Do not use strict sequential loading, and there is no evidence here that four concurrent downloads are better than two.

Split any authority that exceeds a chosen decoded-size limit. `economic-affairs` must be split before treating this design as suitable for a 2 GB Android phone. The complete offline download should run as a resumable background task with visible progress. The app should remain usable with the authorities already stored.

This Windows result does not establish low-memory Android safety. The same combined diagnostics run is still required on the target 2 GB phone. Heap results from this run are also not directly comparable between rows because each strategy inherited memory from the previous strategy and garbage collection occurred at different points.
