import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { globby } from 'globby';

const exec = promisify(execCb);

type Snippet = { file: string; content: string };

type Summary = {
  repoName: string;
  repoPath: string;
  filesScanned: number;
  allFiles: string[];
  keyFiles: string[];
  topDirs: string[];
  packageJson?: any;
  scripts: Record<string, string>;
  deps: string[];
  devDeps: string[];
  entryFiles: string[];
  snippets: Snippet[];
  fingerprint: {
    appType: string;
    runMode: string[];
    keywords: string[];
  };
  capabilities: {
    hasGenAI: boolean;
    hasVoiceOrAudio: boolean;
    hasVideo: boolean;
    hasStateSignals: boolean;
    hasPersistenceSignals: boolean;
    hasFallbackSignals: boolean;
  };
};

export type OutputFormat = 'md' | 'txt' | 'json' | 'docx' | 'pdf';

export type AnalyzeOptions = {
  format?: OutputFormat;
  withSources?: boolean;
};

function src(file: string, note?: string) {
  return `(source: ${file}${note ? ` ${note}` : ''})`;
}

async function loadGitignore(repoPath: string) {
  const patterns: string[] = ['node_modules', '.git', 'dist', '.next', 'coverage'];
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

function classifyAppType(files: string[], pkg?: any): string {
  const has = (re: RegExp) => files.some((f) => re.test(f));

  if (has(/^package\.json$/) && has(/^index\.(ts|js)$/) && !has(/\.(tsx|jsx)$/)) return 'Node CLI/Library';
  if (has(/^vite\.config\.(ts|js|mjs|cjs)$/) && has(/\.(tsx|jsx)$/)) return 'Web App (React + Vite)';
  if (has(/^next\.config\.(js|mjs|ts)$/)) return 'Web App (Next.js)';
  if (has(/^Dockerfile$/i) && has(/^docker-compose\.(yml|yaml)$/i)) return 'Containerized Service/App';
  if (pkg?.workspaces) return 'Monorepo';
  if (has(/\.(tsx|jsx)$/)) return 'Frontend App';
  return 'Software Project';
}

function inferRunModes(scripts: Record<string, string>): string[] {
  const modes: string[] = [];
  if (scripts.dev) modes.push('dev server');
  if (scripts.build) modes.push('build');
  if (scripts.preview || scripts.start) modes.push('preview/runtime');
  if (scripts.test) modes.push('test');
  return modes;
}

function extractKeywords(repoName: string, snippets: Snippet[]): string[] {
  const text = `${repoName}\n${snippets.map((s) => s.content).join('\n')}`.toLowerCase();
  const vocab = [
    'dungeons', 'dragon', 'adventure', 'story', 'branching', 'turn-based', 'game',
    'voice', 'audio', 'video', 'cinematic', 'genai', 'gemini', 'image', 'react', 'vite',
  ];
  return vocab.filter((k) => text.includes(k)).slice(0, 8);
}

function detectCapabilities(files: string[], snippets: Snippet[], deps: string[]): Summary['capabilities'] {
  const text = `${files.join('\n')}\n${snippets.map((s) => s.content).join('\n')}`.toLowerCase();
  const depSet = new Set(deps.map((d) => d.toLowerCase()));

  const hasGenAI = depSet.has('@google/genai') || /gemini|generatecontent|generatevideos|openai|anthropic/.test(text);
  const hasVoiceOrAudio = /audio|voice|tts|speech|mp3|wav/.test(text);
  const hasVideo = /video|generatevideos|\.mp4/.test(text);
  const hasStateSignals = /gamestate|currentplayerindex|choices|log|redux|zustand|context/.test(text);
  const hasPersistenceSignals = /localstorage|indexeddb|supabase|firebase|postgres|mongodb|prisma/.test(text);
  const hasFallbackSignals = /fallback|quota|resource_exhausted|permission_denied|try again|degrade|offline/.test(text);

  return {
    hasGenAI,
    hasVoiceOrAudio,
    hasVideo,
    hasStateSignals,
    hasPersistenceSignals,
    hasFallbackSignals,
  };
}

async function collectSummary(repoPath: string): Promise<Summary> {
  const abs = path.resolve(repoPath);
  const ignorePatterns = await loadGitignore(abs);
  const all = await globby(['**/*'], { cwd: abs, dot: false, onlyFiles: true });
  const files = all.filter((f) => !ignorePatterns.some((p) => f === p || f.startsWith(`${p}/`))).slice(0, 600);

  let packageJson: any = undefined;
  try {
    packageJson = JSON.parse(await fs.readFile(path.join(abs, 'package.json'), 'utf8'));
  } catch {}

  const scripts = (packageJson?.scripts || {}) as Record<string, string>;
  const deps = Object.keys(packageJson?.dependencies || {});
  const devDeps = Object.keys(packageJson?.devDependencies || {});

  const keyFiles = files.filter((f) =>
    /(^README\.md$|^HANDBOOK\.md$|^metadata\.json$|package\.json$|tsconfig\.json$|vite\.config|next\.config|dockerfile|compose|app\.(ts|tsx|js|jsx)$|index\.(ts|tsx|js|jsx)$|services\/.*\.(ts|tsx|js|jsx)$|components\/.*\.(ts|tsx|js|jsx)$|src\/.*\.(ts|tsx|js|jsx|py|go|java|rs)$)/i.test(f)
  ).slice(0, 80);

  const topDirs = [...new Set(files.map((f) => f.split('/')[0]).filter((d) => d && !d.includes('.')))].slice(0, 15);

  const entryCandidates = [
    'src/main.tsx', 'src/main.ts', 'src/index.tsx', 'src/index.ts', 'index.tsx', 'index.ts', 'App.tsx', 'App.ts',
    'vite.config.ts', 'vite.config.js', 'next.config.js', 'next.config.mjs',
  ];
  const entryFiles = entryCandidates.filter((f) => files.includes(f));

  const snippets: Snippet[] = [];
  for (const f of keyFiles.slice(0, 28)) {
    try {
      const raw = await fs.readFile(path.join(abs, f), 'utf8');
      snippets.push({ file: f, content: raw.slice(0, 2200) });
    } catch {}
  }

  const fingerprint = {
    appType: classifyAppType(files, packageJson),
    runMode: inferRunModes(scripts),
    keywords: extractKeywords(path.basename(abs), snippets),
  };

  const capabilities = detectCapabilities(files, snippets, [...deps, ...devDeps]);

  return {
    repoName: path.basename(abs),
    repoPath: abs,
    filesScanned: files.length,
    allFiles: files,
    keyFiles,
    topDirs,
    packageJson,
    scripts,
    deps,
    devDeps,
    entryFiles,
    snippets,
    fingerprint,
    capabilities,
  };
}

function architectureHints(s: Summary): string[] {
  const hints: string[] = [];
  if (s.topDirs.includes('components')) hints.push(`UI components in \`components/\` ${src('components/*')}`);
  if (s.topDirs.includes('services')) hints.push(`Service/API orchestration in \`services/\` ${src('services/*')}`);
  if (s.topDirs.includes('src')) hints.push(`Source-centric layout in \`src/\` ${src('src/*')}`);
  if (s.entryFiles.length) hints.push(`Likely entrypoints: ${s.entryFiles.map((f) => `\`${f}\``).join(', ')} ${src(s.entryFiles[0])}`);
  if (!hints.length) hints.push(`Flat/root-oriented structure detected ${src('repository tree')}`);
  return hints;
}

function projectSpecificRisks(s: Summary): string[] {
  const risks: string[] = [];
  const c = s.capabilities;

  if (c.hasGenAI) {
    risks.push(`GenAI output consistency risk (story drift / repetition / prompt sensitivity) ${src('services/*', 'model calls')}`);
    risks.push(`Latency/cost variance per generation request (text/image/video) ${src('package.json', 'dependencies + runtime flow')}`);
  }
  if (c.hasVideo) {
    risks.push(`Video generation and download failures may impact UX unless explicit retry/timeout UX exists ${src('services/*', 'video generation path')}`);
  }
  if (c.hasVoiceOrAudio) {
    risks.push(`Media playback policy/autoplay constraints can break first-run experience on some browsers ${src('components/*', 'audio/video usage')}`);
  }
  if (c.hasStateSignals && !c.hasPersistenceSignals) {
    risks.push(`Session progress likely volatile across refresh/reopen without persistence strategy ${src('state handling files')}`);
  }
  if (!Object.keys(s.scripts).some((k) => /test/i.test(k))) {
    risks.push(`No explicit automated test script detected (regression risk) ${src('package.json', 'scripts')}`);
  }

  if (!risks.length) {
    risks.push(`Missing explicit reliability/performance guardrails in scanned config ${src('repo scan')}`);
  }
  return risks;
}

function actionPlan(s: Summary): { quick: string[]; next: string[]; hard: string[] } {
  const quick: string[] = [];
  const next: string[] = [];
  const hard: string[] = [];

  quick.push(`Add inline evidence references for all major report claims (impact: trust/readability, files: report generator, acceptance: each key bullet has source).`);

  if (!Object.keys(s.scripts).some((k) => /test/i.test(k))) {
    quick.push(`Add a smoke test command (impact: reliability, files: package.json, acceptance: CI/local can run one non-trivial test).`);
  }

  if (s.capabilities.hasGenAI) {
    next.push(`Instrument generation latency + error rates (impact: reliability/cost, files: services + app flow, acceptance: median/p95 latency and failure counters visible).`);
    next.push(`Add deterministic fallback path when model/API fails (impact: UX continuity, files: service layer, acceptance: demo still progresses during quota or transient errors).`);
  }

  if (s.capabilities.hasStateSignals && !s.capabilities.hasPersistenceSignals) {
    next.push(`Persist key gameplay/session state (impact: user retention, files: state management + storage adapter, acceptance: refresh restores active session).`);
  }

  hard.push(`Introduce scenario-based E2E suite for core user journey (impact: regression prevention, files: test folder + CI, acceptance: green path covers start→play→media generation).`);
  if (s.capabilities.hasGenAI) {
    hard.push(`Build prompt/version governance and output quality checks (impact: output stability, files: prompts + service layer, acceptance: measurable reduction in malformed/repetitive outputs).`);
  }

  return { quick, next, hard };
}

function interviewPitch(s: Summary): string {
  const keywords = s.fingerprint.keywords;
  const hasGenAI = s.capabilities.hasGenAI;
  const hasVideo = s.capabilities.hasVideo;
  const hasAudio = s.capabilities.hasVoiceOrAudio;

  const value = hasGenAI
    ? `I built ${s.repoName}, an interactive app that combines branching storytelling with generative AI to create a playable experience instead of static content.`
    : `I built ${s.repoName}, a project focused on a practical end-to-end user workflow.`;

  const tech = `Technically, it uses ${['React', 'Vite', ...s.deps.filter((d) => d.includes('genai') || d.includes('motion')).map((d) => d)].slice(0, 4).join(', ')} with a service layer that orchestrates state transitions and model/API calls.`;

  const challenge = hasGenAI
    ? `The hardest part was balancing narrative quality with reliability—handling model variability, API limits, and keeping the session coherent turn-by-turn.`
    : `The hardest part was keeping architecture simple while shipping a complete and reproducible workflow.`;

  const validation = `I validated it through a full runnable flow (${Object.keys(s.scripts).join(', ') || 'local run scripts'})${hasVideo || hasAudio ? ' plus media generation/playback demos' : ''}.`;

  return [value, tech, challenge, validation, keywords.length ? `Keywords: ${keywords.join(', ')}.` : ''].filter(Boolean).join(' ');
}

function buildReport(s: Summary): string {
  const arch = architectureHints(s);
  const risks = projectSpecificRisks(s);
  const plan = actionPlan(s);

  return `# RepoLens Report: ${s.repoName}

## 1) Project Fingerprint
- App type: ${s.fingerprint.appType} ${src('package.json / file layout')}
- Core capability keywords: ${s.fingerprint.keywords.join(', ') || 'N/A'} ${src('repo name + README/metadata/key files')}
- Key entry files: ${s.entryFiles.length ? s.entryFiles.map((f) => `\`${f}\``).join(', ') : 'Not confidently detected'} ${src(s.entryFiles[0] || 'entry file scan')}
- Run modes: ${s.fingerprint.runMode.join(', ') || 'N/A'} ${src('package.json', 'scripts')}
- Files scanned: ${s.filesScanned} ${src('repository scan')}

## 2) How to Run
\`\`\`bash
npm install
${s.scripts.dev ? 'npm run dev' : '# no dev script detected'}
${s.scripts.build ? 'npm run build' : '# no build script detected'}
${s.scripts.preview ? 'npm run preview' : '# no preview script detected'}
\`\`\`
- Script map: ${Object.entries(s.scripts).map(([k, v]) => `\`${k}\`: \`${v}\``).join(' | ') || 'N/A'} ${src('package.json', 'scripts')}

## 3) Tech Stack (evidence-linked)
- Runtime: ${s.packageJson ? 'Node.js ecosystem' : 'Unknown'} ${src('package.json')}
- Dependencies: ${s.deps.slice(0, 20).join(', ') || 'N/A'} ${src('package.json', 'dependencies')}
- Dev dependencies: ${s.devDeps.slice(0, 20).join(', ') || 'N/A'} ${src('package.json', 'devDependencies')}

## 4) Architecture at a Glance
${arch.map((x) => `- ${x}`).join('\n')}

## 5) AI / Media Pipeline (if detected)
- GenAI detected: ${s.capabilities.hasGenAI ? 'Yes' : 'No'} ${src('dependencies + key files')}
- Voice/Audio signals: ${s.capabilities.hasVoiceOrAudio ? 'Yes' : 'No'} ${src('components/services scan')}
- Video signals: ${s.capabilities.hasVideo ? 'Yes' : 'No'} ${src('components/services scan')}
- State management signals: ${s.capabilities.hasStateSignals ? 'Yes' : 'No'} ${src('key files content')}
- Persistence signals: ${s.capabilities.hasPersistenceSignals ? 'Yes' : 'No'} ${src('key files content')}
- Fallback/error-handling signals: ${s.capabilities.hasFallbackSignals ? 'Yes' : 'No'} ${src('service/error handling scan')}

## 6) Risks & Mitigations (project-specific)
${risks.map((r) => `- ${r}`).join('\n')}

## 7) Action Plan
### Quick Wins (1–2 hours)
${plan.quick.map((x) => `- ${x}`).join('\n')}

### Next (1–2 days)
${plan.next.map((x) => `- ${x}`).join('\n') || '- No medium-horizon items auto-detected.'}

### Hard (1–2 weeks)
${plan.hard.map((x) => `- ${x}`).join('\n')}

## 8) Interview Pitch (30s)
"${interviewPitch(s)}"
`;
}

function withPrimarySources(report: string, s: Summary): string {
  const appendix = s.snippets
    .slice(0, 10)
    .map((snip, i) => `### Source ${i + 1}: ${snip.file}\n\n\`\`\`\n${snip.content}\n\`\`\``)
    .join('\n\n');
  return `${report}\n\n---\n\n## Evidence Appendix (Primary Source Snippets)\n\n${appendix}`;
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

async function writeByFormat(baseName: string, report: string, summary: Summary, format: OutputFormat): Promise<string> {
  const cwd = process.cwd();
  const mdPath = path.join(cwd, `${baseName}.md`);

  if (format === 'md') {
    await fs.writeFile(mdPath, report, 'utf8');
    return mdPath;
  }

  if (format === 'txt') {
    const txtPath = path.join(cwd, `${baseName}.txt`);
    await fs.writeFile(txtPath, report, 'utf8');
    return txtPath;
  }

  if (format === 'json') {
    const jsonPath = path.join(cwd, `${baseName}.json`);
    await fs.writeFile(jsonPath, JSON.stringify({ summary, report }, null, 2), 'utf8');
    return jsonPath;
  }

  await fs.writeFile(mdPath, report, 'utf8');
  try {
    await exec('pandoc --version');
  } catch {
    throw new Error('docx/pdf output requires pandoc. Install: brew install pandoc');
  }

  if (format === 'docx') {
    const out = path.join(cwd, `${baseName}.docx`);
    await exec(`pandoc "${mdPath}" -o "${out}"`);
    return out;
  }

  const out = path.join(cwd, `${baseName}.pdf`);
  await exec(`pandoc "${mdPath}" -o "${out}"`);
  return out;
}

export async function analyzeRepo(target: string, options: AnalyzeOptions = {}): Promise<string> {
  const format = (options.format || 'md') as OutputFormat;
  const withSources = !!options.withSources;

  const { repoPath, cleanup } = await resolveTargetToLocalPath(target);
  try {
    const summary = await collectSummary(repoPath);
    let report = buildReport(summary);
    if (withSources) report = withPrimarySources(report, summary);
    return await writeByFormat('REPORT', report, summary, format);
  } finally {
    if (cleanup) await cleanup();
  }
}
