# Design fonts

These are the exact WOFF2 faces returned for the original design's Google Fonts stylesheet on 2026-10-12. They are bundled locally so production rendering does not depend on an external stylesheet, DNS lookup or font host. Font families, weights, unicode ranges and selection order are preserved. Repeated faces are grouped for compression without changing their order within any family/style/weight.

`manifest.json` records each source URL, SHA-256-prefix filename and byte count. The five original SIL Open Font Licenses are included here. The browser requests only unicode subsets needed by the visible page; the full font catalog is not preloaded. Do not combine weight descriptors into a continuous range without comparing the pinned design, as doing so can change weight selection.
