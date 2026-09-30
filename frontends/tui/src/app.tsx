import {useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import {Box, Text, useApp, useCursor, useInput, usePaste, useStdout, useWindowSize} from 'ink';
import chalk from 'chalk';
import {ChatWidget} from './chatwidget.js';
import {ChatComposerHistory} from './bottom_pane/chat_composer_history.js';
import {atDraftBoundary, composerLines} from './bottom_pane/chat_composer.js';
import {edit, emptyDraft, insert, replaceDraft, type Draft} from './bottom_pane/textarea.js';
import {modelPickerLines} from './bottom_pane/list_selection_view.js';
import {shortcuts, workingLine} from './bottom_pane/footer.js';
import {cellLines, displayPath, sessionHeader} from './history_cell.js';
import {commands, matchingCommands, unsupported} from './slash_command.js';
import {fit, safeText, wrap} from './terminal.js';

type Overlay = 'model' | 'shortcuts' | 'transcript' | undefined;
interface Search {query: string; index: number; saved: Draft}

export function App({chat}: {chat: ChatWidget}) {
  const state = useSyncExternalStore(chat.subscribe, chat.getSnapshot);
  const {columns, rows} = useWindowSize();
  const width = Math.max(12, columns);
  const height = Math.max(5, rows - 1);
  const {exit} = useApp();
  const {stdout} = useStdout();
  const {setCursorPosition} = useCursor();
  const history = useRef(new ChatComposerHistory());
  const [draft, setDraft] = useState(emptyDraft);
  const draftRef = useRef(draft);
  const changeDraft = (next: Draft) => { draftRef.current = next; setDraft(next); };
  const [overlay, setOverlay] = useState<Overlay>();
  const [selected, setSelected] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [offset, setOffset] = useState(0);
  const [scrollTop, setScrollTop] = useState<number | null>(null);
  const viewport = useRef({top: 0, max: 0, rows: 0});
  const overlayMax = useRef(0);
  const [search, setSearch] = useState<Search>();
  const [now, setNow] = useState(Date.now);
  const [quitting, setQuitting] = useState(false);
  const submitting = useRef(false);
  const closing = useRef(false);
  const reducedMotion = process.env.MINI_CODEX_REDUCED_MOTION === '1';

  useEffect(() => { void chat.initialize(); }, [chat]);
  useEffect(() => {
    if (!stdout.isTTY) return;
    // 请求 SGR 鼠标事件，避免 alternate screen 将滚轮翻译为方向键。
    stdout.write('\x1b[?1000h\x1b[?1006h');
    return () => { stdout.write('\x1b[?1006l\x1b[?1000l'); };
  }, [stdout]);
  useEffect(() => {
    if (!state.busy) return;
    const timer = setInterval(() => setNow(Date.now()), reducedMotion ? 1000 : 50);
    return () => clearInterval(timer);
  }, [state.busy, reducedMotion]);

  const finish = () => {
    if (closing.current) return;
    closing.current = true;
    void chat.close().finally(() => exit());
  };
  useEffect(() => { if (quitting && !state.busy) finish(); }, [quitting, state.busy]);
  const quit = () => {
    if (chat.getSnapshot().busy) {
      chat.waitForExit();
      setQuitting(true);
      chat.notice('正在等待当前回合结束后退出；此内核尚未支持取消执行。');
    } else finish();
  };
  const report = (error: unknown) => chat.notice(error instanceof Error ? error.message : String(error));

  const chooseModel = (index: number) => {
    const model = chat.getSnapshot().models[index];
    if (!model || chat.getSnapshot().changingModel) return;
    void chat.selectModel(model.model).then(() => setOverlay(undefined)).catch(report);
  };

  const command = async (text: string): Promise<boolean> => {
    const [raw, ...args] = text.trim().split(/\s+/);
    const name = raw!.slice(1) === 'cwd' ? 'pwd' : raw!.slice(1);
    const entry = commands.find(item => item.name === name);
    if (!entry) {
      chat.notice(unsupported[name] ? `/${name} 尚未支持：${unsupported[name]}。` : `Unrecognized command '${raw}'. Type '/' for a list of supported commands.`);
      return false;
    }
    if (args.length) { chat.notice(`/${name} 在当前版本不接受参数。`); return false; }
    if (chat.getSnapshot().busy && !entry.busy) { chat.notice(`'/${name}' is disabled while a task is in progress.`); return false; }
    switch (name) {
      case 'model':
        setSelected(Math.max(0, chat.getSnapshot().models.findIndex(model => model.model === chat.getSnapshot().config?.model)));
        setOverlay('model');
        void chat.refreshModels().catch(report);
        break;
      case 'new': case 'clear':
        if (!await chat.newThread(name === 'clear')) return false;
        setOffset(0); setScrollTop(null);
        break;
      case 'pwd': chat.add('info', chat.getSnapshot().thread?.cwd ?? chat.cwd); break;
      case 'status': {
        const current = chat.getSnapshot();
        chat.add('info', [
          'mini-codex v0.1.0',
          `Model: ${current.config?.model ?? 'unknown'}`,
          `Provider: ${current.config?.modelProvider ?? 'unknown'}`,
          `Directory: ${current.thread?.cwd ?? chat.cwd}`,
          `Session: ${current.thread?.id ?? 'starting'} (ephemeral)`,
          'Token usage: unavailable',
          'Not supported: sandbox / approvals, interrupt / steer, resume, file mentions, image input.',
        ].join('\n'));
        break;
      }
      case 'quit': case 'exit': quit(); break;
    }
    return true;
  };

  const send = (text: string, queued: boolean) => {
    if (submitting.current || !text.trim() || quitting) return;
    if (text.startsWith('!')) { chat.notice('尚未支持 ! 直接执行 shell 的交互；不会把它作为普通消息发送。'); return; }
    submitting.current = true;
    const saved = draftRef.current;
    changeDraft(replaceDraft(saved, ''));
    setDismissed(false); setSelected(0); setOffset(0); setScrollTop(null);
    const action = text.startsWith('/') ? command(text) : chat.submit(text, queued);
    void action.then(ok => {
      if (ok) history.current.record(text);
      else if (!draftRef.current.text) changeDraft(saved);
      else chat.add('error', `未发送：${text}`);
    }).catch(error => {
      report(error);
      if (!draftRef.current.text) changeDraft(saved);
      else chat.add('error', `未发送：${text}`);
    }).finally(() => { submitting.current = false; });
  };

  const matches = !dismissed ? matchingCommands(draft.text) : [];
  const choice = Math.min(selected, Math.max(0, matches.length - 1));
  const searchMatches = search ? history.current.matches(search.query) : [];

  usePaste(text => {
    if (overlay || quitting || search) return;
    changeDraft(insert(draftRef.current, text));
    setDismissed(true);
  });

  useInput((input, key) => {
    if (key.eventType === 'release' || closing.current) return;
    // Ink 已将完整 CSI 序列分帧并去掉 ESC；必须在文字/方向键处理前消费鼠标。
    const mouse = /^\[<(\d+);(\d+);(\d+)([Mm])$/.exec(input);
    if (mouse) {
      const button = Number(mouse[1]) & ~28; // 忽略 Shift/Alt/Ctrl 修饰位。
      if (mouse[4] !== 'M' || (button !== 64 && button !== 65)) return;
      const delta = button === 64 ? -3 : 3;
      if (overlay === 'transcript' || overlay === 'shortcuts') {
        setOffset(value => Math.max(0, Math.min(overlayMax.current, value - delta)));
      } else if (!overlay && Number(mouse[3]) <= viewport.current.rows) {
        // 对照 transcript_view/input.rs：每次三行。以顶部行固定阅读位置，
        // 流式追加不会把正在阅读的历史拉回底部；滚到底部恢复跟随。
        const next = Math.max(0, Math.min(viewport.current.max, viewport.current.top + delta));
        viewport.current.top = next;
        setScrollTop(next === viewport.current.max ? null : next);
      }
      return;
    }
    const current = draftRef.current;
    const ctrlC = key.ctrl && input.toLowerCase() === 'c';
    const ctrlD = key.ctrl && input.toLowerCase() === 'd';
    if (overlay) {
      if (key.escape || ctrlC || (key.ctrl && input === 't') || (overlay === 'shortcuts' && input === '?')) {
        setOverlay(undefined); setOffset(0); return;
      }
      if (overlay === 'model') {
        if (key.upArrow || (key.ctrl && input === 'p')) setSelected(value => Math.max(0, value - 1));
        else if (key.downArrow || (key.ctrl && input === 'n')) setSelected(value => Math.min(state.models.length - 1, value + 1));
        else if (key.return) chooseModel(Math.min(selected, state.models.length - 1));
        else if (/^[1-9]$/.test(input)) chooseModel(Number(input) - 1);
      } else {
        if (key.pageUp || key.upArrow) setOffset(value => value + (key.pageUp ? height - 3 : 1));
        if (key.pageDown || key.downArrow) setOffset(value => Math.max(0, value - (key.pageDown ? height - 3 : 1)));
        if (key.home) setOffset(Number.MAX_SAFE_INTEGER);
        if (key.end) setOffset(0);
      }
      return;
    }
    if (search) {
      if (key.escape || ctrlC) { changeDraft(search.saved); setSearch(undefined); return; }
      if (key.return) {
        changeDraft(replaceDraft(current, searchMatches[Math.min(search.index, searchMatches.length - 1)] ?? search.saved.text));
        setSearch(undefined); return;
      }
      if (key.ctrl && input === 'r') setSearch({...search, index: Math.min(search.index + 1, Math.max(0, searchMatches.length - 1))});
      else if (key.ctrl && input === 's') setSearch({...search, index: Math.max(0, search.index - 1)});
      else if (key.backspace) setSearch({...search, query: Array.from(search.query).slice(0, -1).join(''), index: 0});
      else if (!key.ctrl && !key.meta) setSearch({...search, query: search.query + safeText(input), index: 0});
      return;
    }
    if (ctrlC) {
      if (matches.length) { setDismissed(true); return; }
      if (current.text) { history.current.record(current.text); changeDraft(replaceDraft(current, '')); return; }
      if (chat.getSnapshot().busy) { chat.notice('尚未支持取消执行（turn/interrupt）；Ctrl+D 可等待回合完成后退出。'); return; }
      quit(); return;
    }
    if (ctrlD && !current.text && !matches.length) { quit(); return; }
    if (key.ctrl && input === 't') { setOverlay('transcript'); setOffset(0); return; }
    if (key.pageUp) { setOverlay('transcript'); setOffset(height - 3); return; }
    if (input === '?' && !current.text) { setOverlay('shortcuts'); setOffset(Number.MAX_SAFE_INTEGER); return; }
    if (state.phase !== 'ready' || quitting) return;
    if (key.ctrl && input === 'v') { chat.notice('尚未支持图片粘贴；文本可用终端的粘贴快捷键。'); return; }
    if (key.ctrl && input === 'r') { setSearch({query: '', index: 0, saved: current}); return; }
    if (key.upArrow && key.meta) {
      if (current.text) { chat.notice('请先清空草稿，再编辑排队消息。'); return; }
      const queued = chat.takeQueued();
      if (queued !== undefined) changeDraft(replaceDraft(current, queued));
      return;
    }
    if (matches.length) {
      if (key.upArrow) { setSelected(value => (value + matches.length - 1) % matches.length); return; }
      if (key.downArrow) { setSelected(value => (value + 1) % matches.length); return; }
      if (key.tab) { changeDraft(replaceDraft(current, `/${matches[choice]!.name} `)); setDismissed(true); return; }
      if (key.return && !key.shift && !key.meta) { send(`/${matches[choice]!.name}`, false); return; }
      if (key.escape) { setDismissed(true); return; }
    }
    if (key.escape) {
      chat.notice(state.busy ? '尚未支持取消执行（turn/interrupt）。' : 'Esc 编辑上次消息需要 thread/rollback，当前内核尚未支持。');
      return;
    }
    if ((key.return && !key.shift && !key.meta) || key.tab) { send(current.text, key.tab); return; }
    const up = key.upArrow || (key.ctrl && input === 'p');
    const down = key.downArrow || (key.ctrl && input === 'n');
    if ((up || down) && history.current.shouldNavigate(current.text, atDraftBoundary(current))) {
      const recalled = history.current.navigate(up ? -1 : 1);
      if (recalled !== undefined) changeDraft(replaceDraft(current, recalled));
      return;
    }
    const next = edit(current, input, key, Math.max(1, width - 2));
    if (next.text !== current.text) { setDismissed(false); setSelected(0); chat.notice(); }
    changeDraft(next);
  });

  const model = state.config?.model ?? 'connecting…';
  const transcript = useMemo(() => [
    ...sessionHeader(model, chat.cwd, width), '',
    ...state.cells.flatMap(cell => cellLines(cell, width, overlay === 'transcript')),
  ], [state.cells, model, chat.cwd, width, overlay]);

  let screen: string[];
  let cursor: {x: number; y: number} | undefined;
  if (overlay === 'transcript' || overlay === 'shortcuts') {
    const content = overlay === 'transcript' ? transcript : shortcuts.flatMap(line => wrap(line, width - 2).map(value => '  ' + value));
    const visibleHeight = Math.max(1, height - 2);
    overlayMax.current = Math.max(0, content.length - visibleHeight);
    const end = Math.max(visibleHeight, content.length - Math.min(offset, Math.max(0, content.length - visibleHeight)));
    screen = content.slice(Math.max(0, end - visibleHeight), end);
    while (screen.length < height - 1) screen.push('');
    screen.push(chalk.dim(fit('  pgup/pgdn scroll · home/end · esc to return', width)));
  } else {
    const bottom: string[] = [];
    if (overlay === 'model') {
      bottom.push(...modelPickerLines(state.models, Math.min(selected, Math.max(0, state.models.length - 1)), model, width, Math.max(8, height - 3)));
    } else {
      if (state.busy) bottom.push(workingLine(state.startedAt ?? now, now, width, reducedMotion), '');
      if (state.queued.length) bottom.push(chalk.dim(fit(`  ${state.queued.length} queued · ${state.queued[0]} · alt+↑ to edit`, width)));
      if (matches.length) {
        const count = Math.max(1, Math.min(7, height - 9));
        const start = Math.max(0, choice - count + 1);
        matches.slice(start, start + count).forEach((entry, i) => {
          const line = `${i + start === choice ? '›' : ' '} /${entry.name.padEnd(8)} ${entry.description}`;
          bottom.push(i + start === choice ? chalk.cyan(fit(line, width)) : fit(line, width));
        });
      }
      if (search) bottom.push(chalk.cyan(fit(`  reverse-i-search: ${search.query}`, width)), fit('  ' + (searchMatches[Math.min(search.index, searchMatches.length - 1)] ?? 'No match'), width));
      if (state.notice) bottom.push(...wrap(chalk.yellow(safeText(state.notice)), width - 2).slice(0, 3).map(line => '  ' + line));
      const composer = composerLines(draft, width, Math.max(1, Math.min(6, height - bottom.length - 4)), !search && state.phase === 'ready' && !quitting);
      if (composer.cursor) cursor = {...composer.cursor, y: bottom.length + composer.cursor.y};
      bottom.push(...composer.lines, fit(`  ${model} · ${displayPath(chat.cwd)}`, width));
      bottom.push(chalk.dim(fit(state.phase === 'starting' ? '  Connecting to app-server…' : state.changingModel ? '  Saving model…' : state.changingThread ? '  Starting new chat…' : '  ? for shortcuts', width)));
    }
    const available = Math.max(0, height - bottom.length);
    const maxTop = Math.max(0, transcript.length - available);
    const top = scrollTop === null ? maxTop : Math.min(scrollTop, maxTop);
    viewport.current = {top, max: maxTop, rows: available};
    screen = available > 0 ? transcript.slice(top, top + available) : [];
    while (screen.length < available) screen.push('');
    if (cursor) cursor.y += screen.length;
    screen.push(...bottom);
    if (screen.length > height) {
      const clipped = screen.length - height;
      screen = screen.slice(clipped);
      if (cursor) cursor.y -= clipped;
    }
  }
  // useCursor 在 insertion effect 中提交本次渲染写入的坐标。
  // 必须在渲染时设置；放进 useEffect 会晚于 Ink 绘制，使光标落后一帧。
  // hook 自行处理提交与卸载清理，保留真实光标供中文 IME 定位。
  setCursorPosition(cursor && cursor.y >= 0 ? cursor : undefined);
  return <Box width={width} height={height} flexDirection="column"><Text>{screen.join('\n')}</Text></Box>;
}
