# RepoLens CLI

Analyze a local code repository and generate a hiring-style `REPORT.md`.

## Quick Start

```bash
npm install
npm run build
node dist/index.js analyze .
```

Or in dev mode:

```bash
npm run dev -- analyze .
```

## Command

```bash
repolens analyze [path-or-github-url] [options]
```

Options:
- `-f, --format <format>`: `md | txt | json | docx | pdf` (default: `md`)
- `-s, --with-sources`: include primary source snippets in report

Examples:

```bash
repolens analyze .
repolens analyze . --format json
repolens analyze https://github.com/owner/repo --format md --with-sources
repolens analyze https://github.com/owner/repo --format docx
```

- Default target: current folder
- Output path: current directory (e.g. `./REPORT.md`, `./REPORT.pdf`)

> Note: `docx/pdf` conversion requires `pandoc` installed (`brew install pandoc`).

## Notes

- RepoLens now generates a deterministic, evidence-linked report by default.
- Use `--with-sources` to append an evidence appendix with primary snippets.
- A rule/detector template is included at `repolens.rules.template.json` to help you define project fingerprints, flags, and report block selection for specialized project types (e.g., React+Vite+Gemini media apps).
