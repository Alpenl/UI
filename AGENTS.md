# Cairn design repository

- This is the private static design companion to Alpenl/cairn-ui, originally based on alpen-yy/newUI. Read README.md and docs/design-sync.md first.
- Default mode is an offline real-data snapshot. Never fetch production APIs, add credentials, trigger model calls, or publish the private snapshot to a public site.
- Preserve the current component boundaries and design tokens. Keep all new interface text in both locale namespaces; do not translate user content.
- Keep the read-only transport explicit. No network fallback, fake successful saves, or invented classification outcomes. Media must resolve to committed local files.
- Snapshot data has stable IDs/references and a fixed date. Changes to tags, counts, filters or media must stay internally consistent.
- Run pnpm check and pnpm test:e2e. Run pnpm test:live and pnpm test:go when touching shared transport or components.
- Original engineering documentation is retained for context; this repo does not authorize production operations. Production changes belong in cairn-ui/cairn-go and require separate scope.
