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
repolens analyze [path-or-github-url]
```

Examples:

```bash
repolens analyze .
repolens analyze /Users/you/project
repolens analyze https://github.com/owner/repo
```

- Default target: current folder
- Output: `./REPORT.md` (in the directory where you run the command)

## Notes

- If `GEMINI_API_KEY` is set, RepoLens generates AI-enhanced analysis.
- If no API key (or API fails), it generates a deterministic fallback report.
