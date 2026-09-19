import {useEffect, useRef, useState} from 'react';
import {Box, Text, useInput} from 'ink';
import TextInput from 'ink-text-input';
import {Activity, Gradient, Header, palette, useTerminalSize} from './chrome.js';
import {ListSelectionView} from './bottom_pane/list_selection_view.js';
import {MarkdownText} from './markdown_render.js';
import {parseSlashCommand} from './slash_command.js';
import type {Client, ConfigReadResponse, Model, ModelListResponse, Notification, Turn} from './protocol.js';

type Row = {id: string; role: string; text: string; status?: string};
// 模型和工具内容按纯文本展示，不执行终端控制序列。
function plain(text: string) { return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, ''); }

export function App({client, cwd, onExit, demo = false}: {client: Client; cwd: string; onExit: () => void; demo?: boolean}) {
  const {width, height} = useTerminalSize();
  const compact = width < 70 || height < 22;
  const contentWidth = Math.max(10, width - (compact ? 0 : 2));
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('正在连接');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 当前模型由 app-server 依据 config.toml 决定；界面只展示并在 /model 后同步。
  const [model, setModel] = useState('');
  const [modelPicker, setModelPicker] = useState<Model[] | null>(null);
  const threadId = useRef('');
  const activeTurn = useRef('');
  const sending = useRef(false);
  const fatal = useRef(false);
  const userIndex = useRef(0);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') onExit();
    if (key.tab && !modelPicker) setExpanded(value => !value);
  }, {isActive: !modelPicker});
  useEffect(() => {
    let disposed = false;
    const unsubscribe = client.subscribe((event: Notification) => {
      if (!('threadId' in event.params) || event.params.threadId !== threadId.current) return;
      if (event.method === 'thread/settings/applied') { setModel(event.params.settings.model); return; }
      if (activeTurn.current && event.params.turnId !== activeTurn.current) return;
      if (event.method === 'item/agentMessage/delta') {
        const {itemId, delta} = event.params;
        setRows(rows => rows.some(row => row.id === itemId)
          ? rows.map(row => row.id === itemId ? {...row, text: row.text + plain(delta)} : row)
          : [...rows, {id: itemId, role: '助手', text: plain(delta)}]);
      } else if (event.method === 'item/started' || event.method === 'item/completed') {
        const item = event.params.item;
        const row: Row = item.type === 'agentMessage'
          ? {id: item.id, role: '助手', text: plain(item.text)}
          : {id: item.id, role: '工具', text: plain(`${item.command}${item.aggregatedOutput ? '\n' + item.aggregatedOutput : ''}`), status: item.status};
        setRows(rows => rows.some(previous => previous.id === row.id)
          ? rows.map(previous => previous.id === row.id ? row : previous)
          : [...rows, row]);
      } else if (event.method === 'turn/completed') {
        sending.current = false;
        activeTurn.current = '';
        setBusy(false);
        setStatus(event.params.turn.status === 'failed' ? '本轮失败，可重新输入' : '就绪');
        if (event.params.turn.error) setError(plain(event.params.turn.error.message));
      } else if (event.method === 'turn/started') {
        setStatus('正在处理');
      }
    });
    const offFailure = client.onFailure(error => {
      fatal.current = true;
      setError(error.message); setReady(false); setBusy(false); setStatus('连接已断开');
    });
    void (async () => {
      try {
        await client.request('initialize', {clientInfo: {name: 'mini-codex-tui', version: '0.1.0'}});
        client.notify('initialized');
        const result = await client.request<{thread: {id: string}}>('thread/start', {cwd});
        if (disposed) return;
        threadId.current = result.thread.id;
        const config = await client.request<ConfigReadResponse>('config/read', {});
        if (disposed) return;
        setModel(config.config.model ?? '');
        setReady(true); setStatus('就绪');
      } catch (error) { if (!disposed) { setError(String(error)); setStatus('连接失败'); } }
    })();
    return () => { disposed = true; unsubscribe(); offFailure(); };
  }, [client, cwd]);

  function addInfo(text: string) {
    setRows(rows => [...rows, {id: `info-${Date.now()}-${rows.length}`, role: '系统', text}]);
  }

  // 对应源项目 /model：拉取 model/list 后弹出选择器。
  async function openModelPopup() {
    setInput('');
    try {
      const response = await client.request<ModelListResponse>('model/list', {});
      setModelPicker(response.data);
    } catch (error) { setError(String(error)); }
  }

  // 对应源项目选择模型后的两步：thread/settings/update 让当前会话立即生效，
  // config/value/write 把 `model` 写回 config.toml 作为默认值。
  async function selectModel(choice: Model) {
    setModelPicker(null);
    try {
      await client.request('thread/settings/update', {threadId: threadId.current, model: choice.model});
      await client.request('config/value/write', {keyPath: 'model', value: choice.model, mergeStrategy: 'replace'});
      setModel(choice.model);
      addInfo(`模型已切换为 ${choice.model}，并已保存到 config.toml`);
    } catch (error) { setError(String(error)); }
  }

  async function submit(text: string) {
    const command = parseSlashCommand(text);
    if (command === 'exit') { onExit(); return; }
    if (command === 'clear') { setRows([]); setInput(''); return; }
    if (command === 'model') { if (ready && !busy) await openModelPopup(); return; }
    if (!ready || sending.current || !text.trim()) return;
    sending.current = true;
    setBusy(true); setError(''); setStatus('正在处理'); setInput('');
    setRows(rows => [...rows, {id: `user-${++userIndex.current}`, role: '你', text: plain(text)}]);
    try {
      const result = await client.request<{turn: Turn}>('turn/start', {threadId: threadId.current, input: [{type: 'text', text}]});
      // 事件可能与响应在同一批 stdout 数据中到达；已完成时不要复活回合状态。
      if (sending.current) activeTurn.current = result.turn.id;
    } catch (error) {
      sending.current = false; setBusy(false); setError(String(error));
      setStatus(fatal.current ? '连接已断开' : '就绪');
    }
  }

  return <Box flexDirection="column" paddingX={compact ? 0 : 1} width={width} height={Math.max(12, height - 1)}>
    <Header cwd={plain(cwd)} compact={compact} demo={demo} width={contentWidth} model={plain(model)} />
    <Box flexGrow={1} flexShrink={1} minHeight={0} overflow="hidden" flexDirection="column" justifyContent="flex-end">
    <Box flexShrink={0} flexDirection="column">
    {rows.slice(-40).map(row => {
      const tool = row.role === '工具';
      if (row.role === '系统') return <Text key={row.id} dimColor>ⓘ {row.text}</Text>;
      const color = row.role === '你' ? palette.blue : tool ? palette.violet : palette.lavender;
      const lines = row.text.slice(-12000).split('\n');
      const collapsed = tool && !expanded && lines.length > 4;
      return <Box key={row.id} flexDirection="column" marginTop={1} borderStyle="single" borderLeft borderRight={false} borderTop={false} borderBottom={false} borderColor={color} paddingLeft={1}>
        <Box gap={1}>
          <Text bold color={color}>{row.role === '你' ? '◆' : tool ? '⚙' : '✦'} {row.role}{row.status ? ` · ${{inProgress: '运行中', completed: '成功', failed: '失败'}[row.status] ?? row.status}` : ''}</Text>
          {tool && <Text dimColor>exec</Text>}
        </Box>
        {row.role === '助手' && row.text
          ? <MarkdownText text={row.text.slice(-12000)} />
          : <Text>{(collapsed ? lines.slice(0, 4).join('\n') : lines.join('\n')) || '…'}</Text>}
        {collapsed && <Text dimColor>… 还有 {lines.length - 4} 行 · Tab 展开</Text>}
      </Box>;
    })}
    </Box>
    </Box>
    {error && <Box flexShrink={0} borderStyle="round" borderColor={palette.error} flexDirection="column" paddingX={1} marginTop={1}>
      <Text bold color={palette.error}>{ready ? '本轮未完成' : '连接未建立'}</Text>
      <Text>{plain(error)}</Text>
      {!ready && <Box marginTop={1} flexDirection="column">
        <Text dimColor>确认已构建 app-server，并把密钥写入 ~/.mini-codex/.env（启动时自动加载）：</Text>
        <Text color={palette.violet}>DEEPSEEK_API_KEY=你的密钥</Text>
        <Text dimColor>然后重新运行 make tui；仅预览界面可用 pnpm demo。</Text>
      </Box>}
    </Box>}
    <Activity busy={busy} connecting={!ready && !error} failed={Boolean(error)} status={status} turns={userIndex.current} />
    {modelPicker
      ? <ListSelectionView
          title="选择模型"
          subtitle="Enter 应用到当前会话并写入 config.toml"
          items={modelPicker.map(item => ({name: item.model, description: item.description || undefined, isCurrent: item.model === model, isDefault: item.isDefault}))}
          onSelect={index => { void selectModel(modelPicker[index]!); }}
          onCancel={() => setModelPicker(null)} />
      : <Box flexShrink={0} flexDirection="column">
        <Gradient text={'─'.repeat(contentWidth)} />
        <Box>
          <Text bold color={palette.lavender}>❯ </Text>
          {!busy ? <TextInput value={input} onChange={setInput} placeholder={ready ? '你想一起完成什么？' : '输入 /exit 退出'} onSubmit={text => { void submit(text); }} /> : <Text color={palette.violet}>正在思考与执行，回复会出现在上方…</Text>}
        </Box>
        <Gradient text={'─'.repeat(contentWidth)} />
      </Box>}
    <Box flexShrink={0} justifyContent="space-between">
      <Text dimColor>{compact ? 'Enter 发送 · ^C 退出' : 'Enter 发送  /model 选模型  /clear 清屏  /exit 退出'}</Text>
      {!compact && <Text dimColor>Tab {expanded ? '收起' : '展开'}工具 · Ctrl+C 退出</Text>}
    </Box>
  </Box>;
}
