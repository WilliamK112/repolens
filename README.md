# RepoLens CLI

Generate a **hiring-style, evidence-linked repo report** in minutes.

RepoLens analyzes a local repo (or GitHub URL) and outputs `REPORT.md` with project fingerprint, risks, action plan, and interview-ready summary.

---

## Demo

```bash
repolens analyze .
```

Output: `./REPORT.md` (in your current directory)

✅ Works even **without** an API key (deterministic mode)  
✨ If `GEMINI_API_KEY` is set, RepoLens can be extended with AI-enhanced analysis

Sample output: `examples/REPORT.sample.md`

---

## What you get (Report Contents)

RepoLens generates structured sections such as:

- Project Fingerprint (project type + capability keywords)
- Run & Build Reality Check (scripts-based reproducibility)
- Architecture at a Glance
- AI / Media pipeline signals (when detected)
- Project-specific Risks & Mitigations
- Security, Privacy & Cost
- Action Plan (Quick Wins / Next / Hard)
- Interview Pitch (EN + 中文)
- Optional Evidence Appendix (`--with-sources`)

---

## 📂 Project Structure

```txt
.
├── App.tsx
├── components/
│   ├── CharacterCreation.tsx
│   ├── CoverPage.tsx
│   ├── GameDisplay.tsx
│   ├── MusicPlayer.tsx
│   └── VideoPlanModal.tsx
├── services/
│   └── geminiService.ts
├── constants.ts
├── types.ts
└── HANDBOOK.md
```

---

## Install

### Option A — Global install (fastest)

```bash
npm i -g .
repolens analyze .
```

### Option B — Development mode

```bash
npm install
npm run build
node dist/index.js analyze .
```

---

## Usage

```bash
repolens analyze [path-or-github-url] [options]
```

Examples:

```bash
repolens analyze .
repolens analyze /path/to/repo --format json
repolens analyze https://github.com/owner/repo --with-sources
repolens analyze . --format docx
repolens analyze . --format pdf
```

### Options

| Option | Purpose |
|---|---|
| `-f, --format <format>` | Output format: `md | txt | json | docx | pdf` (default: `md`) |
| `-s, --with-sources` | Append primary source snippets for traceability |

---

## Rules-driven reporting (extensible)

RepoLens includes a rules scaffold you can customize:

- `repolens.rules.template.json`

Use it to define:

- profile matching (`match`)
- detector flags (`detectors`)
- evidence mapping (`evidence_map`)
- section selection (`report_blocks`)

This is the path to project-specific reporting (e.g. React+Vite+Gemini media projects).

---

## Pandoc note (for docx/pdf)

- `md/txt/json` formats do **not** need Pandoc
- `docx/pdf` formats require Pandoc

Install Pandoc:

- macOS: `brew install pandoc`
- Ubuntu/Debian: `sudo apt install pandoc`
- Windows: `choco install pandoc`

---

## Limitations & Security Notes

- Large repos are sampled; very large monorepos may need deeper tuning.
- `--with-sources` may include code snippets in output reports — avoid it for sensitive repos.
- GitHub private repositories need authenticated clone support (not fully integrated yet).
- AI outputs (if enabled) can vary; deterministic mode remains available.

---

## Use cases

- Quickly brief an interviewer/reviewer on a project
- Fast onboarding for unfamiliar repos
- Pre-review risk scan before coding changes
- Share reports as markdown/json/docx/pdf

---

## Contributing

```bash
npm install
npm run build
npm run dev -- analyze .
```

PRs are welcome for detector quality, new profiles, and report block improvements.

---

## License

MIT
