# RepoLens Report: dungeons-and-dragons-adventure-voice-version

## 1) Project Fingerprint
- App type: Web App (React + Vite) (source: package.json / file layout)
- Core capability keywords: dungeons, dragon, adventure, story, branching, turn-based, game, voice (source: repo name + README/metadata/key files)
- Key entry files: `index.tsx`, `App.tsx`, `vite.config.ts` (source: index.tsx)
- Run modes: dev server, build, preview/runtime (source: package.json scripts)
- Files scanned: 28 (source: repository scan)

## 2) How to Run
```bash
npm install
npm run dev
npm run build
npm run preview
```
- Script map: `dev`: `vite` | `build`: `vite build` | `preview`: `vite preview` | `lint`: `tsc --noEmit` (source: package.json scripts)

## 3) Tech Stack (evidence-linked)
- Runtime: Node.js ecosystem (source: package.json)
- Dependencies: @google/genai, lucide-react, motion, react, react-dom (source: package.json dependencies)
- Dev dependencies: @types/node, @vitejs/plugin-react, typescript, vite (source: package.json devDependencies)

## 4) Architecture at a Glance
- UI components in `components/` (source: components/*)
- Service/API orchestration in `services/` (source: services/*)
- Likely entrypoints: `index.tsx`, `App.tsx`, `vite.config.ts` (source: index.tsx)

## 5) AI / Media Pipeline (if detected)
- GenAI detected: Yes (source: dependencies + key files)
- Voice/Audio signals: Yes (source: components/services scan)
- Video signals: Yes (source: components/services scan)
- State management signals: Yes (source: key files content)
- Persistence signals: No (source: key files content)
- Fallback/error-handling signals: Yes (source: service/error handling scan)

## 6) Risks & Mitigations (project-specific)
- GenAI output consistency risk (story drift / repetition / prompt sensitivity) (source: services/* model calls)
- Latency/cost variance per generation request (text/image/video) (source: package.json dependencies + runtime flow)
- Video generation and download failures may impact UX unless explicit retry/timeout UX exists (source: services/* video generation path)
- Media playback policy/autoplay constraints can break first-run experience on some browsers (source: components/* audio/video usage)
- Session progress likely volatile across refresh/reopen without persistence strategy (source: state handling files)
- No explicit automated test script detected (regression risk) (source: package.json scripts)

## 7) Security, Privacy & Cost
- API key exposure risk if secrets are client-visible; prefer server-side proxy or controlled env injection (source: services/* API key usage)
- GenAI/video operations can introduce variable runtime cost; add request budgeting and retry limits (source: service/model call paths)
- User-generated content and logs should follow minimal-retention handling (source: app state + log handling)

## 8) Action Plan
### Quick Wins (1–2 hours)
- Add inline evidence references for all major report claims (impact: trust/readability, files: report generator, acceptance: each key bullet has source).
- Add a smoke test command (impact: reliability, files: package.json, acceptance: CI/local can run one non-trivial test).

### Next (1–2 days)
- Instrument generation latency + error rates (impact: reliability/cost, files: services + app flow, acceptance: median/p95 latency and failure counters visible).
- Add deterministic fallback path when model/API fails (impact: UX continuity, files: service layer, acceptance: demo still progresses during quota or transient errors).
- Persist key gameplay/session state (impact: user retention, files: state management + storage adapter, acceptance: refresh restores active session).

### Hard (1–2 weeks)
- Introduce scenario-based E2E suite for core user journey (impact: regression prevention, files: test folder + CI, acceptance: green path covers start→play→media generation).
- Build prompt/version governance and output quality checks (impact: output stability, files: prompts + service layer, acceptance: measurable reduction in malformed/repetitive outputs).

## 9) Interview Pitch (30s)
- EN: "I built dungeons-and-dragons-adventure-voice-version, an interactive app that combines branching storytelling with generative AI to create a playable experience instead of static content. Technically, it uses React, Vite, @google/genai, motion with a service layer that orchestrates state transitions and model/API calls. The hardest part was balancing narrative quality with reliability—handling model variability, API limits, and keeping the session coherent turn-by-turn. I validated it through a full runnable flow (dev, build, preview, lint) plus media generation/playback demos. Keywords: dungeons, dragon, adventure, story, branching, turn-based, game, voice."
- 中文: "我做了 dungeons-and-dragons-adventure-voice-version，把‘选择→状态推进→AI生成→媒体展示’做成可运行闭环，并针对模型波动与生成失败加入可恢复的体验设计。"


---

## Evidence Appendix (Primary Source Snippets)

### Source 1: App.tsx

```
import React, { useState, useEffect, useCallback } from 'react';
import { GameState, VideoPlan, Player } from './types';
import * as geminiService from './services/geminiService';
import PlayerStatsList from './components/PlayerStats';
import GameDisplay from './components/GameDisplay';
import VideoPlanModal from './components/VideoPlanModal';
import CharacterCreation, { PlayerData } from './components/CharacterCreation';
import CoverPage from './components/CoverPage';
import MusicPlayer from './components/MusicPlayer';
import { motion, AnimatePresence } from 'motion/react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<'cover' | 'creation' | 'game'>('cover');
  
  const [isVideoPlanModalOpen, setIsVideoPlanModalOpen] = useState(false);
  const [videoPlan, setVideoPlan] = useState<VideoPlan | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  const [sceneImageUrl, setSceneImageUrl] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  
  const [isGeneratingVideoScene, setIsGeneratingVideoScene] = useState<boolean>(false);
  const [sceneVideoUrl, setSceneVideoUrl] = useState<string | null>(null);

  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState<boolean>(false);
  const [hasTriedCoverGeneration, setHasTriedCoverGeneration] = useState<boolean>(false);

  const [isApiKeySelected, setIsApiKeySelected] = useState<boolean>(false);

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setIsApiKeySelected(hasKey);
      }
    };
    checkApiKey();
  }, []);

