import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { globby } from 'globby';

import { GoogleGenAI } from '@google/genai';

const exec = promisify(execCb);

type Summary = {
  repoName: string;
  filesScanned: number;
  keyFiles: string[];
  packageJson?: any;
  snippets: Array<{ file: string; content: string }>;
};

async function loadGitignore(repoPath: string) {
  const patterns: string[] = ['node_modules', '.git', 'dist'];
  try {
    const txt = await fs.readFile(path.join(repoPath, '.gitignore'), 'utf8');
    for (const line of txt.split('\n')) {
      const p = line.trim();
      if (!p || p.startsWith('#')) continue;
      patterns.push(p.replace(/^\//, ''));
    }
  } catch {}
  return patterns;
}

async function collectSummary(repoPath: string): Promise<Summary> {
  const abs = path.resolve(repoPath);
  const patterns = await loadGitignore(abs);
  const all = await globby(['**/*'], { cwd: abs, dot: false, onlyFiles: true });
  const files = all.filter((f) => !patterns.some((p) => f === p || f.startsWith(`${p}/`))).slice(0, 250);

  const keyFiles = files.filter((f) =>
    /(^README\.md$|package\.json$|tsconfig\.json$|vite\.config|next\.config|dockerfile|compose|src\/.*\.(ts|tsx|js|jsx|py|go|java|rs)$)/i.test(f)
  ).slice(0, 40);

  let packageJson: any = undefined;
  try {
    packageJson = JSON.parse(await fs.readFile(path.join(abs, 'package.json'), 'utf8'));
  } catch {}

  const snippets: Array<{ file: string; content: string }> = [];
  for (const f of keyFiles.slice(0, 20)) {
    try {
      const raw = await fs.readFile(path.join(abs, f), 'utf8');
      snippets.push({ file: f, content: raw.slice(0, 1500) });
    } catch {}
  }

  return {
    repoName: path.basename(abs),
    filesScanned: files.length,
    keyFiles,
    packageJson,
    snippets,
  };
}

function fallbackReport(s: Summary): string {
  const deps = Object.keys(s.packageJson?.dependencies || {});
  const devDeps = Object.keys(s.packageJson?.devDependencies || {});
  return `# RepoLens Report: ${s.repoName}

## 1) Project Overview
- Repo: ${s.repoName}
- Files scanned: ${s.filesScanned}
- Key files found: ${s.keyFiles.length}

## 2) Tech Stack (inferred)
- Runtime: ${s.packageJson ? 'Node.js' : 'Unknown'}
- Dependencies: ${deps.slice(0, 15).join(', ') || 'N/A'}
- Dev dependencies: ${devDeps.slice(0, 15).join(', ') || 'N/A'}

## 3) Setup Commands
\`\`\`bash
npm install
npm run dev
npm run build
\`\`\`

## 4) Risks / Gaps
- Add tests and CI if missing.
- Add architecture diagram in README.
- Validate env vars and error handling paths.

## 5) Improvement Suggestions
1. Add end-to-end smoke tests.
2. Add lint + format checks in CI.
3. Add production deployment docs.

## 6) Interview Pitch (30s)
"I built ${s.repoName}, an app/tool with a practical workflow. I designed the core architecture, implemented the main features, and focused on shipping with clear docs and reproducible setup."
`;
}

async function aiReport(s: Summary): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return fallbackReport(s);

  const ai = new GoogleGenAI({ apiKey });
  const prompt = `You are a senior software engineer reviewing a student project for internship hiring.
Generate a concise markdown report with sections:
1) Project Overview
2) Tech Stack
3) Architecture Notes
4) Risks / Gaps
5) Prioritized Improvements (P0/P1/P2)
6) Resume Bullet Suggestions (3 bullets)
7) Interview Pitch (30 sec)

Project summary JSON:\n${JSON.stringify(s).slice(0, 12000)}
`;

  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const text = resp.text?.trim();
    return text || fallbackReport(s);
  } catch {
    return fallbackReport(s);
  }
}

async function resolveTargetToLocalPath(target: string): Promise<{ repoPath: string; cleanup?: () => Promise<void> }> {
  const isGithubUrl = /^https?:\/\/github\.com\//i.test(target);
  if (!isGithubUrl) {
    return { repoPath: path.resolve(target) };
  }

  const m = target.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!m) throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo');
  const owner = m[1];
  const repo = m[2].replace(/\.git$/i, '');

  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-'));
  const clonePath = path.join(tmpBase, repo);
  await exec(`git clone --depth=1 https://github.com/${owner}/${repo}.git "${clonePath}"`);

  return {
    repoPath: clonePath,
    cleanup: async () => {
      await fs.rm(tmpBase, { recursive: true, force: true });
    },
  };
}

export async function analyzeRepo(target: string): Promise<string> {
  const { repoPath, cleanup } = await resolveTargetToLocalPath(target);
  try {
    const summary = await collectSummary(repoPath);
    const report = await aiReport(summary);
    const outPath = path.join(process.cwd(), 'REPORT.md');
    await fs.writeFile(outPath, report, 'utf8');
    return outPath;
  } finally {
    if (cleanup) await cleanup();
  }
}
