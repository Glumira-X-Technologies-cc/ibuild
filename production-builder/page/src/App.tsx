/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { TITLE, HEADER_LOGO, HEADER_LOGO_ALT } from './brand';
import { Screen, ScreenId, SCREENS, MENU_TO_SCREEN, SHORTCUTS } from './screens';
import { call, builder, newId, chatStream, ideasStep, ideasPrompt, uploadImage, IdeaAnswer } from './api';
import IdeasWork from './IdeasWork';
import { IdeaFlow } from './screens/PromptKit';
import { Icon } from './icons';
import { IconAction } from './screens/ui';
import { replyLines } from './format';
import { PANE_IDS, PaneId, Panes, growPane, paneSnapshot, readPanes, savePanes, togglePane } from './layout';
import { fmtDateTime, fmtTime, laneName } from './format';

// Types
// Idea Library (Kosmo analysis, founder pick 2026-10-14): active, parked, resurfaced (parked 7 days or
// more, back on top), implemented, archived. The state is a field on the idea; archived is the store's own
// archive, which keeps the idea and makes it read-only.
type IdeaState = 'active' | 'parked' | 'resurfaced' | 'implemented' | 'archived';
const RESURFACE_DAYS = 7;
interface SavedIdea {
  id: string;
  text: string;
  state: IdeaState;
  status: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  speaker: string;
  role: 'founder' | 'model';
  time: string;
  text: string;
}

type PlusItem = { label: string; title?: string; hint?: string; run: () => void };
type PlusEntry = PlusItem | '-' | null;
// top and left match getBoundingClientRect. bottom does not: html { zoom } resolves bottom against the
// unzoomed layout height, so a bottom offset can park the menu above the viewport.
function placePlusMenu(anchor: DOMRect, menuW: number, menuH: number) {
  const gap = 4;
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchor.left;
  const maxLeft = vw - margin - menuW;
  if (left > maxLeft) left = Math.max(margin, maxLeft);
  if (left < margin) left = margin;
  const above = anchor.top - gap - menuH;
  let top = above >= margin ? above : anchor.bottom + gap;
  const maxTop = vh - margin - menuH;
  if (top > maxTop) top = Math.max(margin, maxTop);
  if (top < margin) top = margin;
  return { left, top };
}
type Draft = { ideaText?: string; answers?: IdeaAnswer[]; goalText?: string; taskId?: string; stepRes?: any; promptRes?: any };
function readDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem('ais.draft') || 'null');
    return d && typeof d === 'object' ? d : null;
  } catch { return null; }
}

interface TabMenuItem {
  label: string;
  shortcut?: string;
}

interface NavTab {
  id: string;
  label: string;
  menu?: TabMenuItem[];
}

export default function App() {
  const draft = useRef(readDraft()).current;
  // Theme state: dark (Variation 16 baseline) or light
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Movable vertical column widths (Variation 16 baseline: 350px 1fr 350px)
  const [leftWidth, setLeftWidth] = useState<number>(350);
  const [rightWidth, setRightWidth] = useState<number>(350);
  // Workspace panes (layout icon next to Scan): all three by default, at least one, kept per viewer.
  const [panes, setPanes] = useState<Panes>(() => { try { return readPanes(window.localStorage); } catch { return readPanes(null); } });
  const [layoutOpen, setLayoutOpen] = useState<boolean>(false);
  const flipPane = (id: PaneId) => setPanes(p => { const n = togglePane(p, id); if (n === p) showToast('At least one pane stays shown.'); else { try { savePanes(window.localStorage, n); } catch { /* storage blocked */ } } return n; });
  const grow = growPane(panes);
  const leftPaneRef = useRef<HTMLElement>(null);
  const middlePaneRef = useRef<HTMLElement>(null);
  const [isResizingLeft, setIsResizingLeft] = useState<boolean>(false);
  const [isResizingRight, setIsResizingRight] = useState<boolean>(false);

  // Active top tab & dropdown state
  const [activeTab, setActiveTab] = useState<string>('ideas');
  const [openTabMenu, setOpenTabMenu] = useState<string | null>(null);

  // Idea Panel states
  const [ideaText, setIdeaText] = useState<string>(draft?.ideaText || '');
  const [ideaId, setIdeaId] = useState<string | null>(null);
  const [ideaNotice, setIdeaNotice] = useState<string | null>(null);
  const [savedIdeasCollapsed, setSavedIdeasCollapsed] = useState<boolean>(false);

  // Microphone Dictation state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const recognitionRef = useRef<any>(null);


  // Builder status: this page and its API come from one process (server.js on 3001), polled every 15 s.
  const [serverStatus, setServerStatus] = useState<'checking' | 'offline' | 'running'>('checking');
  const [screen, setScreen] = useState<ScreenId | null>(null);
  const [listFilter, setListFilter] = useState<'all' | 'open' | 'checked' | 'conflict'>('all');
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [bugOpen, setBugOpen] = useState<boolean>(false);
  const [bugTitle, setBugTitle] = useState<string>('');
  const [bugDetails, setBugDetails] = useState<string>('');
  const [bugResult, setBugResult] = useState<{ saved: string; issueUrl: string } | null>(null);

  const checkServer = useCallback(() => {
    call('/health').then(() => setServerStatus('running')).catch(() => setServerStatus('offline'));
  }, []);
  useEffect(() => {
    const adds = Array.from(document.querySelectorAll('button[aria-label="Add"]')).map(b => {
      const r = b.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) };
    });
    const split = document.querySelector('.column-splitter') as HTMLElement | null;
    const bg = split ? getComputedStyle(split).backgroundColor : 'none';
    // #region agent log
    fetch('http://127.0.0.1:7411/ingest/003d0e0a-beed-4153-b3d8-af4d375ebfd8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e6c78b'},body:JSON.stringify({sessionId:'e6c78b',hypothesisId:'A',location:'App.tsx:mount',message:'plus and splitter on screen',data:{addCount:adds.length,adds,splitterBg:bg,splitterCount:document.querySelectorAll('.column-splitter').length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, []);
  useEffect(() => {
    checkServer();
    try { setLastScan(localStorage.getItem('ais.lastScan')); } catch { /* storage blocked */ }
    const t = setInterval(checkServer, 15000);
    return () => clearInterval(t);
  }, [checkServer]);
  const fmtScan = (iso: string | null) => iso ? fmtDateTime(new Date(iso)) : 'never';

  // Scan now: a real read of the repo through the Builder. /debug returns scannedAt and findings;
  // if it fails, /bootstrap is read instead and the time it answered is the scan time.
  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      let at: string, msg: string;
      try {
        const d: any = await builder('/debug');
        at = d.scannedAt;
        const n = (Array.isArray(d.findings) ? d.findings : []).filter(Boolean).length;
        msg = `Scanned ${String(d.source).slice(0, 7)}: ${n} finding${n === 1 ? '' : 's'}.`;
      } catch {
        const b: any = await builder('/bootstrap');
        at = new Date().toISOString();
        const w = (Array.isArray(b?.roadmap?.warnings) ? b.roadmap.warnings : []).filter(Boolean).length;
        msg = `Scanned ${String(b?.repo?.commit ?? '').slice(0, 7)}: ${b?.roadmap?.counts?.rows ?? 0} roadmap rows, ${w} warning${w === 1 ? '' : 's'}.`;
      }
      setLastScan(at);
      try { localStorage.setItem('ais.lastScan', at); } catch { /* storage blocked */ }
      showToast(msg);
    } catch (e: any) { showToast(e.message); }
    finally { setScanning(false); }
  };

  // Report a bug: stored in the Builder as a debug report (POST /api/builder/events, debug.create),
  // with a prefilled GitHub issue link for the founder to send if wanted.
  const handleSubmitBug = async () => {
    if (!bugTitle.trim()) { showToast('Say what went wrong first.'); return; }
    try {
      const id = newId('bug');
      await builder('/events', { type: 'debug.create', requestId: id, payload: { id, title: bugTitle.trim(), text: bugDetails, screen: screen || 'ideas', at: new Date().toISOString() } });
      const body = `${bugDetails}\n\nScreen: ${screen || 'ideas'}\nBuilder report: ${id}`;
      setBugResult({ saved: id, issueUrl: `https://github.com/Glumira-X-Technologies-cc/Glumira-7.2/issues/new?title=${encodeURIComponent(bugTitle.trim())}&body=${encodeURIComponent(body)}` });
    } catch (e: any) { showToast(e.message); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= SHORTCUTS.length) { e.preventDefault(); const id = SHORTCUTS[n - 1]; setScreen(id); setActiveTab(SCREENS[id].tab); setOpenTabMenu(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Send (was Take it further): the real question flow from POST /api/builder/ideas/step, prompt from /ideas/prompt.
  const [answers, setAnswers] = useState<IdeaAnswer[]>(Array.isArray(draft?.answers) ? draft.answers : []);
  const [stepRes, setStepRes] = useState<any>(draft?.stepRes ?? null);
  const [answerText, setAnswerText] = useState<string>('');
  const [goalText, setGoalText] = useState<string>(draft?.goalText || '');
  const [taskId, setTaskId] = useState<string>(draft?.taskId || '');
  const [promptRes, setPromptRes] = useState<any>(draft?.promptRes ?? null);
  const [ideaBusy, setIdeaBusy] = useState<boolean>(false);
  const [ideaBusyText, setIdeaBusyText] = useState('');
  const [ideaError, setIdeaError] = useState<string | null>(null);
  useEffect(() => {
    try { localStorage.setItem('ais.draft', JSON.stringify({ ideaText, answers, goalText, taskId, stepRes, promptRes })); } catch { /* storage blocked */ }
  }, [ideaText, answers, goalText, taskId, stepRes, promptRes]);

  // Saved ideas: the Builder store (GET /state ideas), changed through POST /events.
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([]);
  const stateOf = (i: any): IdeaState => i.archivedAt ? 'archived' : i.state === 'implemented' ? 'implemented'
    : i.state === 'parked' ? (Date.now() - Date.parse(i.parkedAt || i.updatedAt || i.createdAt) >= RESURFACE_DAYS * 86400000 ? 'resurfaced' : 'parked') : 'active';
  const loadIdeas = useCallback(() => builder<any>('/state').then(st => setSavedIdeas((st.ideas || [])
    .filter((i: any) => !i.deletedAt)
    .map((i: any) => ({ id: i.id, text: i.text || i.title || '', state: stateOf(i), status: i.taskId ? i.taskId : 'Unfiled', createdAt: fmtDateTime(new Date(i.createdAt)) }))
    .reverse()
    .sort((a: SavedIdea, b: SavedIdea) => (a.state === 'resurfaced' ? 0 : 1) - (b.state === 'resurfaced' ? 0 : 1)))).catch(() => setSavedIdeas([])), []); // eslint-disable-line
  const [ideaView, setIdeaView] = useState<'active' | 'parked' | 'implemented' | 'archived'>('active');
  const inView = (i: SavedIdea) => ideaView === 'active' ? (i.state === 'active' || i.state === 'resurfaced') : i.state === ideaView;
  useEffect(() => { loadIdeas(); }, [loadIdeas]);

  // Deleted idea cache for Undo
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ idea: SavedIdea; index: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatAttachments, setChatAttachments] = useState<{ id: string; name: string }[]>([]);

  // Chat Dock states
  // Real chat: providers from GET /api/builder/providers, replies streamed from POST /api/builder/chat.
  const [providers, setProviders] = useState<{ id: string; name: string; configured: boolean }[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  // Vent (Kosmo analysis, founder pick 2026-10-14): talk the idea through. It writes no prompt and the server
  // saves nothing; this page holds the thread, and Save as idea is the one deliberate way to keep a message.
  const [ventOn, setVentOn] = useState<boolean>(() => { try { return localStorage.getItem('ais.vent') === '1'; } catch { return false; } });
  const [ventMessages, setVentMessages] = useState<ChatMessage[]>([]);
  const ventConversation = useRef<string>(newId('vent'));
  const toggleVent = () => setVentOn(v => { const n = !v; try { localStorage.setItem('ais.vent', n ? '1' : '0'); } catch { /* storage blocked */ } showToast(n ? 'Vent on: talk it through. Nothing is saved unless you press Save as idea.' : 'Vent off: back to the chat.'); return n; });
  const [chatBusy, setChatBusy] = useState<boolean>(false);
  const conversationId = useRef<string>(newId('conv'));
  useEffect(() => {
    builder<any>('/state').then(st => {
      const rows = (Array.isArray(st?.conversations) ? st.conversations : []).filter((m: any) => m && m.conversationId && String(m.text || '').trim());
      if (!rows.length) return;
      const latest = rows.reduce((a: any, b: any) => String(a.createdAt || '') > String(b.createdAt || '') ? a : b);
      conversationId.current = latest.conversationId;
      const thread = rows.filter((m: any) => m.conversationId === latest.conversationId)
        .sort((a: any, b: any) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      setChatMessages(thread.map((m: any) => ({
        id: m.id,
        speaker: m.role === 'user' ? 'Founder' : laneName(m.provider || 'Model'),
        role: m.role === 'user' ? 'founder' as const : 'model' as const,
        time: m.createdAt ? fmtTime(new Date(m.createdAt)) : '',
        text: m.text,
      })));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    builder<{ providers: { id: string; name: string; configured: boolean }[] }>('/providers')
      .then(r => { const list = (Array.isArray(r?.providers) ? r.providers : []).filter(Boolean); setProviders(list); const first = list.find(p => p.configured); if (first) setSelectedModel(first.id); })
      .catch(() => setProviders([]));
  }, []);
  // Grok, Claude and Gemini first. A missing Grok row still shows, so the dock lists it before the server is updated.
  const PICKER_ORDER = ['grok', 'claude', 'gemini'] as const;
  const orderedProviders = (() => {
    const list = (Array.isArray(providers) ? providers : []).filter(Boolean);
    const used = new Set<string>();
    const head = PICKER_ORDER.map(id => {
      const found = list.find(p => p.id === id || p.name.toLowerCase().includes(id));
      if (found) { used.add(found.id); return { ...found, name: laneName(found.name) || found.name }; }
      return { id, name: id === 'grok' ? 'Grok' : id === 'claude' ? 'Claude' : 'Gemini', configured: false };
    });
    return [...head, ...list.filter(p => !used.has(p.id)).map(p => ({ ...p, name: laneName(p.name) || p.name }))];
  })();
  const [chatInput, setChatInput] = useState<string>("");
  const [plusMenu, setPlusMenu] = useState<null | 'ideas' | 'chat'>(null);
  const ideaPlusRef = useRef<HTMLSpanElement>(null);
  const chatPlusRef = useRef<HTMLSpanElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const openPlus = (which: 'ideas' | 'chat', el: HTMLElement | null) => {
    if (plusMenu === which) { setPlusMenu(null); return; }
    let box: { left: number; bottom: number } | null = null;
    if (el) {
      const r = el.getBoundingClientRect();
      box = { left: r.left, bottom: window.innerHeight - r.top + 4 };
    }
    // #region agent log
    fetch('http://127.0.0.1:7411/ingest/003d0e0a-beed-4153-b3d8-af4d375ebfd8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e6c78b'},body:JSON.stringify({sessionId:'e6c78b',hypothesisId:'C',location:'App.tsx:openPlus',message:'plus pressed',data:{which,hasEl:!!el,box},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setPlusMenu(which);
  };
  useLayoutEffect(() => {
    if (!plusMenu) return;
    const anchor = (plusMenu === 'ideas' ? ideaPlusRef : chatPlusRef).current;
    const menu = plusMenuRef.current;
    if (!anchor || !menu) return;
    let logged = false;
    const apply = () => {
      if (!anchor.isConnected) { setPlusMenu(null); return; }
      const r = anchor.getBoundingClientRect();
      const margin = 8;
      menu.style.maxHeight = Math.max(96, window.innerHeight - margin * 2) + 'px';
      const placed = placePlusMenu(r, menu.offsetWidth, menu.offsetHeight);
      menu.style.left = placed.left + 'px';
      menu.style.top = placed.top + 'px';
      menu.style.visibility = 'visible';
      if (!logged) {
        logged = true;
        // #region agent log
        fetch('http://127.0.0.1:7411/ingest/003d0e0a-beed-4153-b3d8-af4d375ebfd8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e6c78b'},body:JSON.stringify({sessionId:'e6c78b',hypothesisId:'C',location:'App.tsx:placePlus',message:'plus menu placed',data:{which:plusMenu,left:placed.left,top:placed.top,viewportHeight:window.innerHeight},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
    };
    apply();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPlusMenu(null); };
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || menu.contains(t) || anchor.contains(t)) return;
      setPlusMenu(null);
    };
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', apply);
    document.addEventListener('scroll', apply, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', apply);
      document.removeEventListener('scroll', apply, true);
    };
  }, [plusMenu]);
  const ideaImageRef = useRef<HTMLInputElement>(null);
  const ideaFileRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<null | 'github' | 'terminal'>(null);
  useEffect(() => {
    if (!tool) return;
    // #region agent log
    fetch('http://127.0.0.1:7411/ingest/003d0e0a-beed-4153-b3d8-af4d375ebfd8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e6c78b'},body:JSON.stringify({sessionId:'e6c78b',hypothesisId:'D',location:'App.tsx:tool',message:'bottom tool opened',data:{tool,hasRowSplitter:!!document.querySelector('.row-splitter')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [tool]);
  const [ghRepo, setGhRepo] = useState('Glumira-X-Technologies-cc/Glumira-7.2');
  const [ghBranch, setGhBranch] = useState('agent/grok/builder');
  const [ghPath, setGhPath] = useState('');
  const [ghBody, setGhBody] = useState('');
  const [bashCmd, setBashCmd] = useState('');
  const [toolOut, setToolOut] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastHasUndo, setToastHasUndo] = useState<boolean>(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const undoAction = useRef<null | (() => void)>(null);

  const showToast = useCallback((msg: string, hasUndo: boolean = false) => {
    undoAction.current = null;
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    setToastHasUndo(hasUndo);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      setToastHasUndo(false);
    }, 4500);
  }, []);

  // Synchronize body class for theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('theme-light');
    } else {
      root.classList.remove('theme-light');
    }
  }, [theme]);

  // Web Speech API initialization for microphone dictation
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        showToast("Microphone active: Dictating idea...");
      };

      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }

        if (finalChunk) {
          setIdeaText(prev => (prev ? `${prev.trim()} ${finalChunk.trim()}` : finalChunk.trim()));
          setInterimTranscript('');
          if (!ideaNotice) {
            setIdeaNotice("Your idea text changed via voice dictation. Press Send to start again with it.");
          }
        } else {
          setInterimTranscript(currentInterim);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition event:", event.error);
        if (event.error === 'not-allowed') {
          showToast("Microphone permission denied. Enable microphone in browser settings.");
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Soft ignore
        } else {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn("Could not start SpeechRecognition:", e);
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
    };
  }, [showToast, ideaNotice]);

  const toggleListening = () => {
    if (!speechSupported) {
      showToast("Voice dictation isn't available in this browser.");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
      setIsListening(false);
      showToast("Dictation stopped.");
    } else {
      try {
        recognitionRef.current?.start();
      } catch (err) {
        console.warn("Start error:", err);
        setIsListening(false);
      }
    }
  };

  // Draggable Column Resizing Handlers
  const handleMouseDownLeft = (e: React.MouseEvent) => {
    e.preventDefault();
    // #region agent log
    fetch('http://127.0.0.1:7411/ingest/003d0e0a-beed-4153-b3d8-af4d375ebfd8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e6c78b'},body:JSON.stringify({sessionId:'e6c78b',hypothesisId:'E',location:'App.tsx:handleMouseDownLeft',message:'left splitter drag start',data:{x:e.clientX},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    setIsResizingLeft(true);
  };

  const handleMouseDownRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newWidth = Math.max(260, Math.min(550, e.clientX));
        setLeftWidth(newWidth);
      } else if (isResizingRight) {
        const windowWidth = window.innerWidth;
        const newWidth = Math.max(260, Math.min(550, windowWidth - e.clientX));
        setRightWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizingLeft || isResizingRight) {
        setIsResizingLeft(false);
        setIsResizingRight(false);
      }
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  const resetColumnWidths = () => {
    setLeftWidth(350);
    setRightWidth(350);
    showToast("Layout reset.");
  };

  // Tab definitions
  const tabs: NavTab[] = [
    { id: 'ideas', label: 'IDEAS' },
    {
      id: 'daily',
      label: 'DAILY',
      menu: [
        { label: 'Today', shortcut: 'Ctrl+1' },
        { label: 'Diary', shortcut: 'Ctrl+2' }
      ]
    },
    {
      id: 'build',
      label: 'BUILD',
      menu: [
        { label: 'Build list', shortcut: 'Ctrl+3' },
        { label: 'Library', shortcut: 'Ctrl+4' }
      ]
    },
    {
      id: 'van-clief',
      label: 'VAN CLIEF',
      menu: [
        { label: 'Structure', shortcut: 'Ctrl+5' },
        { label: 'Estate', shortcut: 'Ctrl+6' }
      ]
    },
    {
      id: 'tools',
      label: 'TOOLS',
      menu: [
        { label: 'Modules' },
        { label: 'Prompt kit' },
        { label: 'Conscience' },
        { label: 'Resources' }
      ]
    }
  ];

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const ideaErr = (e: any) => {
    const msg = e?.code === 'ROUTING_MAP_STALE'
      ? 'The routing map is out of date. Refresh it on the Builder before making a prompt.'
      : (e?.message || 'The Builder could not take this idea further.');
    setIdeaError(msg); showToast(msg);
  };
  const runStep = async (next: IdeaAnswer[]) => {
    if (!ideaText.trim()) { showToast('Write the idea first.'); return; }
    setIdeaBusy(true); setIdeaBusyText(''); setIdeaError(null);
    try {
      const r: any = await ideasStep({ idea: ideaText.trim(), answers: next, goal: goalText || undefined, taskId: taskId.trim() || undefined });
      setAnswers(r.answers || next); setStepRes(r); setAnswerText('');
      if (r.blocked) setIdeaError(r.stale ? 'The routing map is out of date. ' + r.blocked : r.blocked);
      if (r.playback?.goal && !goalText) setGoalText(r.playback.goal);
    } catch (e: any) { ideaErr(e); } finally { setIdeaBusy(false); }
  };
  const handleTakeItFurther = () => {
    setIdeaNotice(null); setPromptRes(null); setGoalText(''); runStep([]);
  };
  const handleAnswer = (value?: string) => {
    const q = stepRes?.question; const v = (value ?? answerText).trim();
    if (!q || !v) return;
    runStep([...answers.filter(a => a.id !== q.id), { id: q.id, answer: v, ask: q.ask }]);
  };
  const handleMakePrompt = async (pick?: { id: string; role?: string }, extra: IdeaAnswer[] = []) => {
    setIdeaBusy(true); setIdeaBusyText('Writing the prompt. Skill selection runs in the background.'); setIdeaError(null);
    // What only the founder knows (optional, from the goal card) rides with the answers, word for word.
    const base = pick?.role ? [...answers.filter(a => a.id !== 'role'), { id: 'role', answer: pick.role, ask: 'Who should do the work?' }] : answers;
    const next = [...base.filter(a => !extra.some(x => x.id === a.id)), ...extra];
    const skills = (Array.isArray(stepRes?.chosen) ? stepRes.chosen : []).filter((c: any) => c && c.kind !== 'agent').map((c: any) => String(c.id));
    const chosen = pick && !pick.role ? [pick.id, ...skills.filter((id: string) => id !== pick.id)] : undefined;
    try {
      const r: any = await ideasPrompt({ idea: ideaText.trim(), answers: next, goal: goalText || undefined, taskId: taskId.trim() || undefined, confirmed: true, ...(chosen ? { chosen } : {}) });
      if (pick?.role) setAnswers(next);
      setPromptRes(r); setScreen(null); showToast('Prompt ready.');
    } catch (e: any) { ideaErr(e); } finally { setIdeaBusy(false); }
  };
  const resetProcess = () => { setAnswers([]); setStepRes(null); setPromptRes(null); setGoalText(''); setIdeaError(null); setAnswerText(''); };
  const ideaFlow = {
    idea: ideaText, answers, step: stepRes, result: promptRes,
    busy: ideaBusy ? (ideaBusyText || 'Working…') : '', error: ideaError,
    onAnswer: (text: string) => handleAnswer(text), onWrite: (pick?: { id: string; role?: string }, extra?: IdeaAnswer[]) => { void handleMakePrompt(pick, extra); }, onReset: resetProcess,
  };

  const handleClearIdea = () => {
    setIdeaText(""); setIdeaId(null); setIdeaNotice(null); setStepRes(null); setAnswers([]); setPromptRes(null); setIdeaError(null); setGoalText('');
    showToast("Idea cleared.");
  };
  const handleNewIdea = () => {
    const empty = !ideaText.trim() && answers.length === 0 && !stepRes && !promptRes && !goalText;
    if (empty) { showToast('The idea box is already empty.'); return; }
    const snap = { text: ideaText, id: ideaId, answers: [...answers], step: stepRes, prompt: promptRes, goal: goalText, notice: ideaNotice, error: ideaError };
    setIdeaText(''); setIdeaId(null); setIdeaNotice(null); setStepRes(null); setAnswers([]); setPromptRes(null); setIdeaError(null); setGoalText(''); setAnswerText('');
    showToast('New idea. The last one is kept.', true);
    undoAction.current = () => {
      setIdeaText(snap.text); setIdeaId(snap.id); setAnswers(snap.answers); setStepRes(snap.step); setPromptRes(snap.prompt); setGoalText(snap.goal); setIdeaNotice(snap.notice); setIdeaError(snap.error);
    };
  };

  const ideaEvent = async (type: string, payload: any) => builder('/events', { type, requestId: newId('idea'), payload });
  const handleSaveIdea = async () => {
    if (!ideaText.trim()) { showToast('Write the idea first.'); return; }
    const id = newId('idea');
    try { await ideaEvent('idea.create', { id, text: ideaText.trim(), ...(taskId.trim() ? { taskId: taskId.trim() } : {}) }); setIdeaId(id); loadIdeas(); showToast('Idea saved.'); }
    catch (e: any) { showToast(e.message); }
  };
  const handleParkIdea = async () => {
    if (!ideaText.trim()) { showToast('Write the idea first.'); return; }
    const at = new Date().toISOString();
    const existing = ideaId && savedIdeas.some(i => i.id === ideaId && i.state !== 'archived') ? ideaId : null;
    const id = existing || newId('idea');
    try {
      await ideaEvent(existing ? 'idea.update' : 'idea.create', { id, text: ideaText.trim(), state: 'parked', parkedAt: at, ...(taskId.trim() ? { taskId: taskId.trim() } : {}) });
      setIdeaId(id); setIdeaView('parked'); setSavedIdeasCollapsed(false); loadIdeas();
      showToast(`Idea parked. It comes back on top after ${RESURFACE_DAYS} days.`);
    } catch (e: any) { showToast(e.message); }
  };
  const handleDeleteIdea = async (id: string) => {
    const idx = savedIdeas.findIndex(i => i.id === id);
    if (idx === -1) return;
    try { await ideaEvent('idea.delete', { id }); setRecentlyDeleted({ idea: savedIdeas[idx], index: idx }); loadIdeas(); showToast("Idea deleted.", true); }
    catch (e: any) { showToast(e.message); }
  };
  const handleUndoDelete = async () => {
    if (!recentlyDeleted) return;
    try { await ideaEvent('idea.restore', { id: recentlyDeleted.idea.id }); loadIdeas(); } catch (e: any) { showToast(e.message); }
    setRecentlyDeleted(null); setToastMessage(null); setToastHasUndo(false);
  };
  const handleIdeaState = async (id: string, state: 'active' | 'parked' | 'implemented') => {
    const at = new Date().toISOString();
    try {
      await ideaEvent('idea.update', { id, state, ...(state === 'parked' ? { parkedAt: at } : {}), ...(state === 'implemented' ? { implementedAt: at } : {}) });
      loadIdeas();
      showToast(state === 'parked' ? `Idea parked. It comes back on top after ${RESURFACE_DAYS} days.` : state === 'implemented' ? 'Idea marked implemented.' : 'Idea is active again.');
    } catch (e: any) { showToast(e.message); }
  };
  const handleArchiveIdea = async (id: string) => {
    try { await ideaEvent('idea.archive', { id }); loadIdeas(); showToast("Idea archived."); } catch (e: any) { showToast(e.message); }
  };
  const handleLoadIdea = (idea: { id: string; text: string }) => {
    setIdeaText(idea.text); setIdeaId(idea.id); setStepRes(null); setAnswers([]); setPromptRes(null);
    setIdeaNotice("Loaded saved idea. Press Send to start with it.");
  };

  const handleChatImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (f) await attachPicked(f, 'chat');
  };
  const attachPicked = async (f: File, where: 'ideas' | 'chat') => {
    if (f.type.startsWith('image/')) {
      try {
        const r: any = await uploadImage(f);
        const id = r.id || r.attachment?.id;
        if (where === 'chat') {
          if (!id) throw new Error('The Builder did not return an attachment id.');
          setChatAttachments(prev => [...prev, { id, name: f.name }]);
        }
        showToast(`Attached ${f.name}.`);
      } catch (err: any) { showToast(err.message); }
      return;
    }
    const body = await f.text().catch(() => '');
    const note = `[file] ${f.name}\n${body.slice(0, 4000)}`;
    if (where === 'ideas') setIdeaText(prev => prev ? `${prev}\n\n${note}` : note);
    else setChatInput(prev => prev ? `${prev}\n\n${note}` : note);
    showToast(`Added ${f.name}.`);
  };
  const runGithub = async (action: 'read' | 'write') => {
    setToolOut('Working…');
    try {
      const r: any = await builder('/github', { action, repo: ghRepo, branch: ghBranch, path: ghPath, content: action === 'write' ? ghBody : undefined });
      const textOut = typeof r?.text === 'string' ? r.text : JSON.stringify(r);
      if (action === 'read' && typeof r?.text === 'string') setGhBody(r.text);
      setToolOut(textOut);
    } catch (err: any) { setToolOut(err.message); }
  };
  const runBash = async () => {
    setToolOut('Running…');
    try {
      const r: any = await builder('/bash', { command: bashCmd });
      setToolOut(typeof r?.text === 'string' ? r.text : JSON.stringify(r));
    } catch (err: any) { setToolOut(err.message); }
  };

  const handleSendVent = async (textOverride?: string) => {
    const text = (textOverride ?? chatInput).trim();
    if (!text || chatBusy) return;
    if (!selectedModel) { showToast('No chat model is set up yet.'); return; }
    const now = () => fmtTime(new Date());
    const speaker = laneName(orderedProviders.find(p => p.id === selectedModel)?.name || selectedModel);
    const history = ventMessages.filter(m => m.text).slice(-40).map(m => ({ role: m.role === 'founder' ? 'user' as const : 'assistant' as const, text: m.text }));
    const replyId = newId('msg');
    setVentMessages(prev => [...prev, { id: newId('msg'), speaker: 'Founder', role: 'founder', time: now(), text }, { id: replyId, speaker, role: 'model', time: now(), text: '' }]);
    if (textOverride === undefined) setChatInput('');
    setChatBusy(true);
    const patch = (f: (t: string) => string) => setVentMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: f(m.text) } : m));
    try {
      const done = await chatStream({ requestId: newId('vent'), conversationId: ventConversation.current, provider: selectedModel, text, mode: 'vent', history, context: { idea: ideaText } }, { delta: t => patch(x => x + t) });
      const final = done?.message?.text; if (typeof final === 'string' && final) patch(() => final);
    } catch (e: any) {
      setVentMessages(prev => prev.filter(m => !(m.id === replyId && !m.text)));
      showToast(e.message || 'Vent failed.');
    } finally { setChatBusy(false); }
  };
  const ventIdea = () => {
    const text = ideaText.trim();
    if (!text) { showToast('Write the thought first.'); return; }
    setVentOn(true);
    try { localStorage.setItem('ais.vent', '1'); } catch { /* storage blocked */ }
    void handleSendVent('Listen to this vent without converting it into a work instruction. Reflect the concern without inventing facts.\n\n' + text);
  };
  const saveAsIdea = async (text: string) => {
    if (!text.trim()) return;
    try { await ideaEvent('idea.create', { id: newId('idea'), text: text.trim(), from: 'vent' }); loadIdeas(); showToast('Saved to the Idea Library.'); } catch (e: any) { showToast(e.message); }
  };

  // The chat reads the other two panes as they are now (founder 2026-10-15, verbatim: "Add function to chat that can
  // read the other 2 panes"). A hidden pane is still read and marked hidden; each pane is capped and says when cut.
  const middleTitle = screen ? SCREENS[screen].label : 'Ideas';
  const tabLabel = (tabs.find(t => t.id === activeTab)?.label || activeTab).toString();
  const readPanesNow = () => [
    paneSnapshot('left', tabLabel, 'Founder capture', !panes.left, leftPaneRef.current?.innerText || ''),
    paneSnapshot('middle', tabLabel, middleTitle, !panes.middle, middlePaneRef.current?.innerText || ''),
  ];

  const handleSendChat = async () => {
    if (ventOn) { void handleSendVent(); return; }
    const text = chatInput.trim();
    if ((!text && !chatAttachments.length) || chatBusy) return;
    if (!selectedModel) { showToast('No chat model is set up yet.'); return; }
    const now = () => fmtTime(new Date());
    const speaker = laneName(orderedProviders.find(p => p.id === selectedModel)?.name || selectedModel);
    const replyId = newId('msg');
    setChatMessages(prev => [...prev, { id: newId('msg'), speaker: 'Founder', role: 'founder', time: now(), text: text + (chatAttachments.length ? ` [${chatAttachments.map(a => a.name).join(', ')}]` : '') },
      { id: replyId, speaker, role: 'model', time: now(), text: '' }]);
    setChatInput(''); setChatAttachments([]); setChatBusy(true);
    const patch = (f: (t: string) => string) => setChatMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: f(m.text) } : m));
    try {
      const done = await chatStream({ requestId: newId('chat'), conversationId: conversationId.current, provider: selectedModel, text, context: { page: screen || 'ideas', panes: readPanesNow() }, ...(chatAttachments.length ? { attachmentIds: chatAttachments.map(a => a.id) } : {}) }, { delta: d => patch(t => t + d) });
      const final = done?.message?.text; if (typeof final === 'string' && final) patch(() => final);
    } catch (e: any) {
      setChatMessages(prev => prev.filter(m => !(m.id === replyId && !m.text)));
      showToast(e.message || 'Chat failed.');
    } finally { setChatBusy(false); }
  };

  const handleClearChat = () => {
    if (ventOn) { setVentMessages([]); ventConversation.current = newId('vent'); showToast('Vent cleared. Nothing of it was saved.'); return; }
    setChatMessages([]); conversationId.current = newId('conv');
    showToast("Chat thread cleared.");
  };

  const handleCopyPrompt = () => {
    if (!promptRes?.prompt) { showToast('Make a prompt first.'); return; }
    navigator.clipboard.writeText(promptRes.prompt);
    showToast("Copied.");
  };

  const resumeWork = async (item: { kind: 'chat' | 'prompt' | 'work'; id: string; text?: string; taskId?: string; conversationId?: string; provider?: string; messages?: ChatMessage[] }) => {
    if (item.kind === 'work') {
      const text = (item.text || '').trim();
      const task = item.taskId || item.id;
      if (!text) { showToast('This card has no text to work.'); return; }
      setIdeaText(text);
      setTaskId(task);
      setAnswers([]);
      setStepRes(null);
      setPromptRes(null);
      setGoalText('');
      setAnswerText('');
      setIdeaNotice(null);
      setIdeaError(null);
      setScreen(null);
      setActiveTab('ideas');
      setIdeaBusy(true);
      try {
        const r: any = await ideasStep({ idea: text, answers: [], taskId: task || undefined });
        setAnswers(r.answers || []);
        setStepRes(r);
        if (r.blocked) setIdeaError(r.stale ? 'The routing map is out of date (ROUTING_MAP_STALE). ' + r.blocked : r.blocked);
        if (r.playback?.goal) setGoalText(r.playback.goal);
    showToast(r.question ? 'Answer the question under the idea.' : 'Working this card.');
      } catch (e: any) { ideaErr(e); } finally { setIdeaBusy(false); }
      return;
    }
    if (item.kind === 'chat') {
      if (item.conversationId) conversationId.current = item.conversationId;
      if (item.provider) setSelectedModel(item.provider);
      setChatMessages(item.messages || []);
      showToast('Opened in the chat.');
      return;
    }
    if (!item.text) { showToast('That prompt was not stored.'); return; }
    setPromptRes({ prompt: item.text });
    setScreen(null);
    setActiveTab('ideas');
    showToast('Opened in the builder.');
  };

  const go = (id: string, filter?: 'all' | 'open' | 'checked') => {
    if (!Object.prototype.hasOwnProperty.call(SCREENS, id)) return;
    const next = id as ScreenId;
    setListFilter(next === 'build' ? (filter || 'all') : 'all');
    setScreen(next);
    setActiveTab(SCREENS[next].tab);
    setOpenTabMenu(null);
  };

  // Row 2 pieces, placed over the columns (see ROW 2 below).
  const tabBar = (
    <div className="tab-row flex items-center gap-0.5 min-w-0">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const hasMenu = !!tab.menu;
        const isMenuOpen = openTabMenu === tab.id;
        return (
          <div key={tab.id} className="relative">
            <button
              onClick={() => {
                setActiveTab(tab.id);
                if (!hasMenu) setScreen(null);
                setOpenTabMenu(hasMenu ? (isMenuOpen ? null : tab.id) : null);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`nav-tab flex items-center gap-1 focus:outline-none ${isActive ? 'is-active' : ''}`}
            >
              <span>{tab.label}</span>
              {hasMenu && <Icon name="arrow-down" size={6} className={`opacity-60 text-[var(--shade-color)] transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />}
            </button>
            {hasMenu && isMenuOpen && (
              <div className="absolute top-full left-0 mt-1 py-1 w-44 rounded bg-[var(--bg-nav)] border border-[var(--border-color)] shadow-xl z-50">
                {tab.menu?.map(sub => (
                  <button
                    key={sub.label}
                    onClick={() => { if (MENU_TO_SCREEN[sub.label]) setScreen(MENU_TO_SCREEN[sub.label]); setOpenTabMenu(null); }}
                    className="w-full px-3 py-1.5 text-left text-xs text-[var(--shade-color)] hover:text-[var(--gold-text)] hover:bg-[var(--bg-main)] flex items-center justify-between transition-colors"
                  >
                    <span>{sub.label}</span>
                    {sub.shortcut && <span className="text-xs mono-code text-[var(--shade-color)]">{sub.shortcut}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
  const startServer = () => {
    if (serverStatus !== 'offline') return;
    setServerStatus('checking');
    builder('/service/start', {}).then(() => { showToast('Server starting.'); checkServer(); }).catch((e: any) => { setServerStatus('offline'); showToast(e?.message || 'The server did not start.'); });
  };
  // One control. When the server is offline, this button starts GlumiraProxy. There is no second command beside it.
  const statusPill = (
    <button
      type="button"
      role="status"
      aria-live="polite"
      onClick={startServer}
      disabled={serverStatus !== 'offline'}
      title={serverStatus === 'running' ? 'The server answers on this address.' : serverStatus === 'offline' ? 'Start the server.' : 'Checking the server.'}
      className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-[var(--bg-panel)] text-[var(--text-main)] border border-[var(--border-color)] whitespace-nowrap disabled:cursor-default"
    >
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${serverStatus === 'running' ? 'bg-[var(--success)]' : serverStatus === 'offline' ? 'bg-[var(--error)]' : 'bg-[var(--shade-color)]'}`}></span>
      <span>{serverStatus === 'running' ? 'Server running' : serverStatus === 'offline' ? 'Server offline' : 'Checking…'}</span>
    </button>
  );
  const lastScanned = (
    <span className="text-xs text-[var(--shade-color)] font-mono flex items-center gap-1.5 whitespace-nowrap" title="When Scan now last read the repository">
      <Icon name="clock" size={12} />
      <span>Last scanned: {fmtScan(lastScan)}</span>
    </span>
  );
  const composerSaved = Boolean(ideaId && savedIdeas.some(i => i.id === ideaId && i.state !== 'archived'));
  const hasIdeaFlow = Boolean(stepRes || answers.length || promptRes);
  const ideaPlusItems: PlusEntry[] = [
    { label: 'New idea', hint: 'clears all', title: 'Clear the idea, its questions and the prompt. Undo brings them back.', run: handleNewIdea },
    '-',
    { label: 'Vent', hint: 'no work instruction', title: 'Vent: talk it through in the chat, no work instruction', run: ventIdea },
    { label: 'Save idea', title: 'Save the idea to the Idea Library', run: () => { void handleSaveIdea(); } },
    { label: 'Park idea', title: `Set it aside; it comes back on top after ${RESURFACE_DAYS} days`, run: () => { void handleParkIdea(); } },
    composerSaved ? { label: 'Archive idea', title: 'Keep it, read-only, in Archived', run: () => { if (!ideaId) return; const id = ideaId; setIdeaId(null); void handleArchiveIdea(id); } } : null,
    hasIdeaFlow ? '-' : null,
    hasIdeaFlow ? { label: 'Start over', title: 'Clear the questions and start again', run: resetProcess } : null,
    '-',
    { label: 'Copy idea', title: 'Copy idea', run: () => { navigator.clipboard.writeText(ideaText || '').then(() => showToast('Copied.'), () => showToast('Clipboard access is unavailable.')); } },
    '-',
    { label: 'Add image', run: () => ideaImageRef.current?.click() },
    { label: 'Add file', run: () => ideaFileRef.current?.click() },
    { label: 'GitHub read / write', run: () => setTool('github') },
    { label: 'Terminal', run: () => setTool('terminal') },
  ];
  const chatPlusItems: PlusEntry[] = [
    { label: 'Add image', run: () => fileInputRef.current?.click() },
    { label: 'Add file', run: () => chatFileRef.current?.click() },
    { label: 'GitHub read / write', run: () => setTool('github') },
    { label: 'Terminal', run: () => setTool('terminal') },
  ];
  const plusRows = (plusMenu === 'ideas' ? ideaPlusItems : chatPlusItems).filter((row): row is PlusItem | '-' => row !== null);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden select-none bg-[var(--bg-main)] text-[var(--text-main)]">
      {/* =========================================================================
          ROW 1 (founder reference, 2026-10-15: "engineered and designed"): the shield and the title on the left,
          only the small icons on the right (report a bug, scan, layout, theme).
          ========================================================================= */}
      <header
        className="h-[50px] shrink-0 px-5 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-nav)]"
        style={{ zIndex: 30 }}
      >
        <div className="flex items-center gap-3">
          <img src={HEADER_LOGO} alt={HEADER_LOGO_ALT} className="h-[38px] w-auto shrink-0 select-none" draggable={false} />
          <span className="title">
            <span className="gold-word">{TITLE.replace(/ ?Production Builder$/, '')}</span> Production Builder
          </span>
        </div>

        <div className="flex items-center gap-1">
          <IconAction icon="bug" title="Report a bug" onClick={() => { setBugOpen(true); setBugResult(null); }} />
          <IconAction icon="reload" title={scanning ? 'Scanning…' : 'Scan now'} spin={scanning} onClick={handleScan} />
          <div className="relative">
            <IconAction icon="layout" title="Choose which panes show" active={layoutOpen} onClick={() => setLayoutOpen(o => !o)} />
            {layoutOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 w-48 rounded bg-[var(--bg-nav)] border border-[var(--border-color)] shadow-xl z-50" onMouseLeave={() => setLayoutOpen(false)}>
                {PANE_IDS.map(id => (
                  <label key={id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-main)] cursor-pointer hover:bg-[var(--bg-panel)]">
                    <input type="checkbox" checked={panes[id]} onChange={() => flipPane(id)} />
                    <span>{id === 'left' ? 'Left: Founder capture' : id === 'middle' ? `Middle: ${screen ? SCREENS[screen].label : 'Ideas'}` : 'Right: Chat'}</span>
                  </label>
                ))}
                <p className="px-3 pt-1 text-xs text-[var(--shade-color)]">At least one pane stays shown.</p>
              </div>
            )}
          </div>
          <IconAction icon={theme === 'dark' ? 'sun' : 'moon'} title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={toggleTheme} />
        </div>
      </header>

      {/* =========================================================================
          ROW 2 lines up with the three columns below it: the tabs over the left pane, the Builder status and
          Last scanned over the middle, the chat heading, Vent and the model over the chat.
          ========================================================================= */}
      <div
        className="h-[40px] shrink-0 flex items-stretch border-b border-[var(--border-color)] bg-[var(--bg-nav)] text-[0.85rem] relative"
        style={{ zIndex: 25 }}
      >
        {panes.left && <div style={grow === 'left' ? undefined : { width: `${leftWidth}px` }} className={`${grow === 'left' ? 'flex-1' : 'shrink-0'} pl-4 pr-1 flex items-center`}>{tabBar}</div>}
        {panes.middle && <div className="flex-1 min-w-0 px-5 flex items-center justify-center gap-4">
          {!panes.left && tabBar}
          {statusPill}
          {lastScanned}
        </div>}
        {panes.right && <div style={grow === 'right' ? undefined : { width: `${rightWidth}px` }} className={`${grow === 'right' ? 'flex-1' : 'shrink-0'} px-5 flex items-center gap-3`}>
          {!panes.left && !panes.middle && tabBar}
          {!panes.middle && statusPill}
          <span className="nav-tab is-active">{ventOn ? 'VENT' : 'CHAT'}</span>
          <div className="hairline-v h-4" />
          <button type="button" onClick={toggleVent} aria-pressed={ventOn} title={ventOn ? 'Back to the chat' : 'Talk the idea through. Writes no prompt, saves nothing.'}
            className={`text-xs px-2 py-0.5 rounded-full border ${ventOn ? 'border-[var(--gold)] text-[var(--gold-text)]' : 'border-[var(--border-color)] text-[var(--shade-color)] hover:text-[var(--gold-text)]'}`}>Vent</button>
          <label className="flex items-center gap-2 text-xs text-[var(--shade-color)] ml-auto">
            <span>Model</span>
            <select
              aria-label="Chat model"
              value={selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                showToast(`Chatting with ${orderedProviders.find(p => p.id === e.target.value)?.name || e.target.value}.`);
              }}
              className="text-xs input-work-gold rounded px-2 py-0.5 min-w-[7rem]"
            >
              {!selectedModel && <option value="">{providers.length ? 'Choose model' : 'No models yet'}</option>}
              {orderedProviders.map(p => <option key={p.id} value={p.id} disabled={!p.configured}>{p.name}{p.configured ? '' : ' (not set up)'}</option>)}
            </select>
          </label>
        </div>}
        {!panes.middle && !panes.right && <div className="px-5 flex items-center gap-4">{statusPill}{lastScanned}</div>}
      </div>

      {/* =========================================================================
          MAIN WORKSPACE: 3 PANELS WITH MOVABLE DRAGGABLE SPLITTERS
          Panel A (Left) | Panel B (Center) | Panel C (Right)
          ========================================================================= */}
      <main className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* =======================================================================
            PANEL A: IDEA PANEL (Left, movable width, default 350px)
            ======================================================================= */}
        <section
          ref={leftPaneRef}
          style={{ ...(grow === 'left' ? {} : { width: `${leftWidth}px` }), ...(panes.left ? {} : { display: 'none' }) }}
          className={`${grow === 'left' ? 'flex-1' : 'shrink-0'} flex flex-col panel-pad bg-[var(--bg-main)] overflow-y-auto select-text`}
        >
          {/* Label: FOUNDER CAPTURE */}
          <div className="flex items-center justify-between mb-2">
            <div className="label-text">Founder Capture</div>
            {isListening && (
              <span className="text-xs font-semibold text-[var(--gold-text)] mic-active">
                Listening…
              </span>
            )}
          </div>

          {/* Textarea: rests in calm tone, turns gold only when worked in */}
          <textarea
            rows={5}
            value={ideaText}
            onChange={e => {
              setIdeaText(e.target.value);
              if (!e.target.value.trim()) setIdeaId(null);
              if (!ideaNotice) {
                setIdeaNotice("Your idea text changed. Press Send to start again with it.");
              }
            }}
            placeholder="Write your idea."
            className="w-full input-work-gold p-2.5 rounded box-border text-sm leading-relaxed resize-y overflow-auto min-h-[96px]"
          />

          {interimTranscript && (
            <div className="text-xs text-[var(--gold-light)] italic mt-1 animate-pulse">
              listening: "{interimTranscript}"
            </div>
          )}

          {/* Composer Controls Toolbar: consistent row placement */}
          <div className="flex items-center justify-between mt-2.5 pt-1">
            <div className="flex items-center gap-1 relative">
              <IconAction icon="microphone" title={isListening ? 'Stop voice dictation' : 'Dictate the idea with the microphone'} active={isListening} className={isListening ? 'mic-active' : ''} onClick={toggleListening} />
              <span ref={ideaPlusRef} className="inline-flex">
                <IconAction icon="add" title="Idea options: New idea, Vent, Save, Park and more" onClick={() => openPlus('ideas', ideaPlusRef.current)} />
              </span>
              <input ref={ideaImageRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) attachPicked(f, 'ideas'); }} />
              <input ref={ideaFileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) attachPicked(f, 'ideas'); }} />
              <IconAction label="Clear" title="Clear the idea" onClick={handleClearIdea} />
            </div>

            {/* The primary action, renamed by the founder 2026-10-15: "replace take it further with send". */}
            <button onClick={handleTakeItFurther} className="btn-gold" aria-label="Send the idea to the Builder">
              Send
            </button>
          </div>

          {/* Notice Card */}
          {ideaNotice && (
            <div className="mt-3 p-2 rounded border border-[var(--warning)] bg-[var(--notice-bg)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-main)]">{ideaNotice}</span>
              <button
                onClick={() => setIdeaNotice(null)}
                className="text-[var(--shade-color)] hover:text-[var(--text-main)] ml-2"
              >
                <Icon name="close" size={12} title="Close" />
              </button>
            </div>
          )}

          {/* Send: real questions from the Builder */}
          <div className="flex items-center gap-2 mt-3 text-xs">
            <input value={taskId} onChange={e => setTaskId(e.target.value)} placeholder="Roadmap card (optional)" className="flex-1 input-work-gold rounded px-2 py-1 text-xs" />
            <IconAction label="Save idea" title="Save the idea to the Idea Library" onClick={handleSaveIdea} />
          </div>
          {ideaError && <div className="mt-3 p-2 rounded border border-[var(--error)] text-xs text-[var(--text-main)]">{ideaError}</div>}
          {stepRes && screen && screen !== 'prompt' && <div className="mt-4"><IdeaFlow toast={showToast} idea={ideaFlow} onlyQuestions showToolkit={false} /></div>}

          {/* Idea Library: Active (with Resurfaced on top), Park, Implemented, Archived */}
          <div className="flex items-center justify-between mt-6 mb-2">
            <div className="label-text">Idea Library ({savedIdeas.filter(i => i.state !== 'archived').length})</div>
            <IconAction label={savedIdeasCollapsed ? 'Expand' : 'Collapse'} title={savedIdeasCollapsed ? 'Show the ideas' : 'Minimize the ideas'} onClick={() => setSavedIdeasCollapsed(!savedIdeasCollapsed)} />
          </div>

          {!savedIdeasCollapsed && (<>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 text-xs">
              {([['active', 'Active'], ['parked', 'Park'], ['implemented', 'Implemented'], ['archived', 'Archived']] as const).map(([v, label]) => {
                const n = savedIdeas.filter(i => v === 'active' ? (i.state === 'active' || i.state === 'resurfaced') : i.state === v).length;
                return <button key={v} type="button" onClick={() => setIdeaView(v)} className={`${ideaView === v ? 'text-[var(--gold-text)]' : 'text-[var(--shade-color)] hover:text-[var(--gold-text)]'}`}>{label} ({n})</button>;
              })}
            </div>
            <div className="space-y-2">
              {savedIdeas.filter(inView).length === 0 && <p className="text-xs text-[var(--shade-color)]">{ideaView === 'active' ? 'No active ideas. Write one and press Save idea.' : `No ${ideaView === 'parked' ? 'park' : ideaView} ideas.`}</p>}
              {savedIdeas.filter(inView).map(idea => {
                const act = (label: string, onClick: () => void, title: string, danger = false) => <IconAction label={label} title={title} danger={danger} onClick={onClick} />;
                return (
                <div key={idea.id} className="card-var16">
                  {idea.state === 'resurfaced' && <div className="text-xs uppercase tracking-wider text-[var(--gold-text)] mb-1">Resurfaced · parked {RESURFACE_DAYS}+ days ago</div>}
                  <p className="text-xs text-[var(--text-main)] leading-relaxed">{idea.text}</p>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-[var(--border-color)]">
                    <span className="text-xs text-[var(--shade-color)] mono-code">{idea.status} · {idea.createdAt}</span>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {act('Load', () => handleLoadIdea(idea), 'Load into the idea box')}
                      {(idea.state === 'active' || idea.state === 'resurfaced') && act('Park', () => handleIdeaState(idea.id, 'parked'), `Set it aside; it comes back on top after ${RESURFACE_DAYS} days`)}
                      {(idea.state === 'active' || idea.state === 'resurfaced') && act('Implemented', () => handleIdeaState(idea.id, 'implemented'), 'Mark it done')}
                      {(idea.state === 'parked' || idea.state === 'resurfaced' || idea.state === 'implemented') && act('Make active', () => handleIdeaState(idea.id, 'active'), 'Back to the active list')}
                      {idea.state !== 'archived' && act('Archive', () => handleArchiveIdea(idea.id), 'Keep it, read-only, in Archived')}
                      {idea.state !== 'archived' && act('Delete', () => handleDeleteIdea(idea.id), 'Delete (Undo follows)', true)}
                    </div>
                  </div>
                </div>);
              })}
            </div>
          </>)}
        </section>

        {/* SPLITTER 1: Draggable Left Column Resizer (1px ultra-thin line) */}
        <div
          style={panes.left && (panes.middle || panes.right) ? undefined : { display: 'none' }}
          onMouseDown={handleMouseDownLeft}
          title="Drag to resize. Double-click to reset the layout."
          onDoubleClick={resetColumnWidths}
          className={`column-splitter ${isResizingLeft ? 'active-resizing' : ''}`}
        />

        {/* =======================================================================
            PANEL B: MAIN VIEW (Center, background var(--bg-panel))
            Complete Build Brief with Food Calibration cards
            ======================================================================= */}
        <section ref={middlePaneRef} style={panes.middle ? undefined : { display: 'none' }} className="main-view flex-1 overflow-y-auto select-text panel-pad bg-[var(--bg-panel)]">
          {screen ? <Screen key={`${screen}:${listFilter}`} id={screen} toast={showToast} resume={resumeWork} go={go} listFilter={listFilter} idea={ideaFlow} /> : (<>
          <IdeaFlow toast={showToast} idea={ideaFlow} showToolkit={false} />
          <IdeasWork prompt={promptRes} idea={ideaText} taskId={taskId.trim()} answers={answers} onCopy={handleCopyPrompt} onEvidence={() => {}} toast={showToast} showPrompt={false} />
          </>)}
        </section>

        {/* SPLITTER 2: Draggable Right Column Resizer (1px ultra-thin line) */}
        <div
          style={panes.middle && panes.right ? undefined : { display: 'none' }}
          onMouseDown={handleMouseDownRight}
          title="Drag to resize. Double-click to reset the layout."
          onDoubleClick={resetColumnWidths}
          className={`column-splitter ${isResizingRight ? 'active-resizing' : ''}`}
        />

        {/* =======================================================================
            PANEL C: CHAT DOCK (Right, movable width, default 350px)
            ======================================================================= */}
        <aside
          style={{ ...(grow === 'right' ? {} : { width: `${rightWidth}px` }), ...(panes.right ? {} : { display: 'none' }) }}
          className={`${grow === 'right' ? 'flex-1' : 'shrink-0'} flex flex-col panel-pad bg-[var(--bg-main)] overflow-y-auto select-text`}
        >
          {/* The chat heading, Vent and the model sit in row 2 above this pane; the pane starts with the messages. */}
          {/* Messages in Variation 16 Card format */}
          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            {ventOn && <p className="text-xs text-[var(--shade-color)]">Vent: talk it through. It writes no prompt, and nothing here is saved unless you press Save as idea.</p>}
            {(ventOn ? ventMessages : chatMessages).map(msg => (
              <div
                key={msg.id}
                className="card-var16"
                style={{
                  background: msg.role === 'founder' ? 'var(--bg-nav)' : 'var(--bg-panel)',
                  margin: 0
                }}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[var(--shade-color)]">{msg.speaker}:</span>
                  <span className="text-xs mono-code text-[var(--shade-color)]">{msg.time}</span>
                </div>
                <div className="text-xs text-[var(--text-main)] leading-relaxed">{replyLines(msg.text).map((l, i) => l.heading ? <div key={i} className="font-semibold mt-1">{l.text}</div> : <div key={i} className="whitespace-pre-wrap">{l.text || '\u00a0'}</div>)}</div>
                {ventOn && msg.text && <div className="flex justify-end mt-1"><button type="button" onClick={() => saveAsIdea(msg.text)} className="text-xs text-[var(--shade-color)] hover:text-[var(--gold-text)]">Save as idea</button></div>}
              </div>
            ))}
          </div>

          {/* Chat Composer */}
          <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
            {!ventOn && <p className="text-xs text-[var(--shade-color)] mb-1" title="Each message carries what these panes show now, capped, with no keys.">reads: Founder capture{panes.left ? '' : ' (hidden)'}, {middleTitle}{panes.middle ? '' : ' (hidden)'}</p>}
            <textarea
              rows={5}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              placeholder="Ask, steer this page, or capture a thought. Enter sends, Shift+Enter adds a line."
              className="w-full input-work-gold p-2.5 rounded box-border text-sm leading-relaxed resize-y overflow-auto"
            />

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1 relative">
                <span ref={chatPlusRef} className="inline-flex">
                  <IconAction icon="add" title="Add" onClick={() => openPlus('chat', chatPlusRef.current)} />
                </span>

                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleChatImage} />
                <input ref={chatFileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) attachPicked(f, 'chat'); }} />
                {chatAttachments.length > 0 && <span className="text-xs mono-code text-[var(--shade-color)]">{chatAttachments.length} image{chatAttachments.length > 1 ? 's' : ''}</span>}
                <IconAction label="Clear" title="Clear the chat" onClick={handleClearChat} />
              </div>

              <button onClick={handleSendChat} className="btn-gold">
                Send
              </button>
            </div>
          </div>
        </aside>
      </main>

      {tool && (
        <div className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-nav)] px-4 py-3 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span className="label-text">{tool === 'github' ? 'GitHub' : 'Terminal'}</span>
            <button type="button" className="text-[var(--shade-color)] hover:text-[var(--gold-text)]" onClick={() => setTool(null)}>Close</button>
          </div>
          {tool === 'github' ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className="input-work-gold min-w-0 flex-1 rounded px-2 py-1" value={ghRepo} onChange={e => setGhRepo(e.target.value)} aria-label="Repository" />
                <input className="input-work-gold w-40 rounded px-2 py-1" value={ghBranch} onChange={e => setGhBranch(e.target.value)} aria-label="Branch" />
                <button type="button" className="btn-gold" onClick={() => runGithub('read')}>Read</button>
                <button type="button" className="btn-gold" onClick={() => runGithub('write')}>Write</button>
              </div>
              <input className="input-work-gold w-full rounded px-2 py-1" value={ghPath} onChange={e => setGhPath(e.target.value)} aria-label="Path" placeholder="Path in the repo" />
              <textarea className="input-work-gold w-full rounded px-2 py-1" rows={3} value={ghBody} onChange={e => setGhBody(e.target.value)} aria-label="File content" />
            </div>
          ) : (
            <div className="flex gap-2">
              <input className="input-work-gold min-w-0 flex-1 rounded px-2 py-1 mono-code" value={bashCmd} onChange={e => setBashCmd(e.target.value)} aria-label="Bash command" onKeyDown={e => { if (e.key === 'Enter') runBash(); }} />
              <button type="button" className="btn-gold" onClick={runBash}>Run</button>
            </div>
          )}
          {toolOut && <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-[var(--shade-color)]">{toolOut}</pre>}
        </div>
      )}

      {/* Icon attribution (Streamline Core, CC BY 4.0, see src/icons/LICENSE.md) */}
      <footer className="shrink-0 px-4 py-1 text-[0.7rem] text-[var(--shade-color)] border-t border-[var(--border-color)] text-right">
        <a href="https://streamlinehq.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--gold-text)] transition-colors">
          Free icons from Streamline
        </a>
      </footer>

      {bugOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setBugOpen(false)}>
          <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded w-full max-w-lg flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--shade-color)]">Report a bug</h3>
              <button onClick={() => setBugOpen(false)} className="text-[var(--shade-color)] hover:text-[var(--gold-text)]"><Icon name="close" size={12} title="Close" /></button>
            </div>
            <div className="p-5 space-y-2 text-xs">
              {bugResult ? (<>
                <p className="text-[var(--text-main)]">Saved in the Builder as <span className="mono-code">{bugResult.saved}</span>.</p>
                <a href={bugResult.issueUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--gold-text)]">Open as a GitHub issue</a>
              </>) : (<>
                <input value={bugTitle} onChange={e => setBugTitle(e.target.value)} placeholder="What went wrong" className="w-full input-work-gold rounded px-2 py-1.5" />
                <textarea rows={5} value={bugDetails} onChange={e => setBugDetails(e.target.value)} placeholder="Steps, what you expected, what happened" className="w-full input-work-gold rounded p-2" />
              </>)}
            </div>
            <div className="p-3 border-t border-[var(--border-color)] flex justify-end gap-2">
              {bugResult ? <button className="btn-var16" onClick={() => { setBugOpen(false); setBugTitle(''); setBugDetails(''); }}>Done</button>
                : <button className="btn-var16" onClick={handleSubmitBug}>Save bug</button>}
            </div>
          </div>
        </div>
      )}

      {plusMenu && createPortal(
        <div
          ref={plusMenuRef}
          role="menu"
          aria-label={plusMenu === 'ideas' ? 'Idea options: New idea, Vent, Save, Park and more' : 'Chat options'}
          className="fixed z-50 w-72 overflow-y-auto rounded border border-[var(--border-color)] bg-[var(--bg-nav)] py-1 shadow-xl"
          style={{ visibility: 'hidden', left: 0, top: 0 }}
        >
          {plusRows.map((item, i) => item === '-'
            ? <hr key={`rule-${i}`} className="my-1 border-[var(--border-color)]" />
            : <button key={item.label} type="button" role="menuitem" title={item.title || item.label}
                className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-xs text-[var(--shade-color)] hover:bg-[var(--bg-panel)] hover:text-[var(--gold-text)]"
                onClick={() => { setPlusMenu(null); item.run(); }}>
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.hint ? <span className="shrink-0 text-[var(--shade-color)]">{item.hint}</span> : null}
              </button>)}
        </div>,
        document.body,
      )}

      {/* =========================================================================
          TOAST FEEDBACK (With Undo)
          ========================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 px-3.5 py-2 rounded bg-[var(--bg-nav)] border border-[var(--border-color)] shadow-xl flex items-center gap-3 text-xs">
          <span className="text-[var(--text-main)]">{toastMessage}</span>
          {toastHasUndo && (
            <button
              onClick={() => {
                const custom = undoAction.current;
                undoAction.current = null;
                if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
                setToastMessage(null);
                setToastHasUndo(false);
                if (custom) custom();
                else void handleUndoDelete();
              }}
              className="text-[var(--shade-color)] hover:text-[var(--gold-text)] font-semibold transition-colors"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
