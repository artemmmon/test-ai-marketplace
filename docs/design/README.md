# Catalog site design

Design for the static catalog site described in [`docs/specs/site.md`](../specs/site.md), built with the `frontend-design` skill and checked against `web-design-guidelines` rules.

Live canvas (private, owner only): https://claude.ai/artifact/9jknyrybCSWHfGpzPAbho6

The `.dc.html` files are the canvas source (Claude Design format); `canvas.json` is the board layout. Content uses the fictitious fixtures from §12.1 of the spec.

| Board | File |
|---|---|
| Search, desktop, dark | `Main.dc.html` |
| Plugin page (`sdd-engineering`) | `Plugin.dc.html` |
| Artifact page (`engineering-paved-path:hooks`) | `Artifact.dc.html` |
| Search, mobile | `SearchMobile.dc.html` |
| Getting started, light | `GettingStarted.dc.html` |
| Empty catalog (current real state) | `EmptyCatalog.dc.html` |

## Decisions

- **Look:** a parts catalogue. Plugin and component names are set in JetBrains Mono as two-tone identifiers (`plugin:` muted, name bright), like part numbers. UI text is Schibsted Grotesk. Both fonts are OFL and must be self-hosted in the real site (NFR-42 forbids CDN fonts; the canvas loads them from Google Fonts only for preview).
- **Install "slip":** every command is one mono line with the Copy button joined to its right edge. It is the same element on the plugin page, getting started and artifact pages.
- **Themes:** dark-first slate blue (`#161B26`) with a periwinkle accent (`#A9B6FF`); light theme on `#F3F4F7` with `#3346B8`. Each board has a `theme` tweak to switch.
- **Type colours:** six tinted badge pairs, always with an icon and a label, so colour is never the only signal (FR-51). `Hook` uses orange because it executes code; the `Executes code` warning is amber with a triangle icon.
- **Copy:** sentence case, as in the spec; no all-caps section labels.

## Tokens (spec §6.2)

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#161B26` | `#F3F4F7` |
| `--surface` | `#1D2331` | `#FFFFFF` |
| `--surface-raised` | `#262D3E` | `#FFFFFF` |
| `--border` | `#353D51` | `#D6DAE3` |
| `--text` | `#E7EAF1` | `#1B2030` |
| `--text-muted` | `#A4ACBE` | `#566074` |
| `--accent` | `#A9B6FF` | `#3346B8` |
| `--accent-contrast` | `#151A33` | `#FFFFFF` |
| `--focus-ring` | `#C6CEFF` | `#3346B8` |
| `--mark-bg` / text | `#5B4A1A` / `#FFE8AE` | `#FFE49A` / `#3A2A00` |
| `--warning-bg` / `--warning-text` | `#3A2B12` / `#F6C36E` | `#FFF2D9` / `#6E4600` |
| `--danger` | `#FF8C8C` | `#B42323` |
| `--success` | `#7ED9A0` | `#1E7A45` |
| `--code-bg` | `#11151E` | `#EEF0F5` |
| `--type-plugin-bg/-fg` | `#2B3256` / `#CDD5FF` | `#E4E8FF` / `#2D3C9E` |
| `--type-skill-bg/-fg` | `#173B37` / `#86E3D2` | `#D9F3EE` / `#0D5E52` |
| `--type-agent-bg/-fg` | `#3E2440` / `#F5B0E0` | `#F8E1F1` / `#8A2468` |
| `--type-command-bg/-fg` | `#29371C` / `#BFE68F` | `#E6F2D6` / `#3D5E12` |
| `--type-hook-bg/-fg` | `#432A1C` / `#FFBA94` | `#FDE6DA` / `#8F3A0E` |
| `--type-mcp-bg/-fg` | `#1B3148` / `#A3D3FF` | `#DCEBFA` / `#1D4E80` |

Contrast was checked by calculation, not with a tool: body and muted text pairs are above 4.5:1 in both themes. Run Lighthouse on the real build (NFR-1).

## Not designed yet

What's new, 404, loading skeletons, error state, the mobile filter panel and the tablet layout.
