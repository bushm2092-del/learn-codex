<script setup lang="ts">
import { ref } from 'vue'

const url = ref('https://api.deepseek.com/responses')
const apiKey = ref('')
const model = ref('deepseek-v4-flash')
const prompt = ref('请只回复：接口连通')
const responseText = ref('尚未发起请求。响应体会在这里完整显示。')
const running = ref(false)
const error = ref('')

async function sendRequest() {
  running.value = true
  error.value = ''
  responseText.value = ''
  try {
    const response = await fetch(url.value, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.value,
        instructions: '你是一个接口测试助手。',
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt.value }] }],
        store: false,
        stream: true,
      }),
    })
    const reader = response.body?.getReader()
    if (!reader) responseText.value = await response.text()
    else {
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        responseText.value += decoder.decode(value, { stream: true })
      }
      responseText.value += decoder.decode()
    }
    if (!response.ok) error.value = `HTTP ${response.status}：接口返回错误，请检查完整响应体。`
  } catch (requestError) {
    error.value = requestError instanceof Error ? requestError.message : String(requestError)
    responseText.value = '请求未能完成。若浏览器提示 CORS，请改用 curl 或 Rust CLI 测试。'
  } finally {
    running.value = false
  }
}
</script>

<template>
  <section class="response-tester" aria-label="Responses 协议测试台">
    <header class="tester-header"><div><span>RESPONSE PROTOCOL TEST</span><strong>直接请求并查看完整响应体</strong></div><small>Key 仅保留在当前页面内存</small></header>
    <div class="tester-form">
      <label>response-url<input v-model="url" type="url" autocomplete="url" spellcheck="false"></label>
      <label>api-key<input v-model="apiKey" type="password" autocomplete="off" placeholder="输入 API Key"></label>
      <label>model<input v-model="model" type="text" autocomplete="off" spellcheck="false"></label>
      <label class="wide">input<input v-model="prompt" type="text" autocomplete="off"></label>
      <button type="button" :disabled="running || !url || !apiKey || !model || !prompt" @click="sendRequest">{{ running ? '请求中…' : '发送请求' }}</button>
    </div>
    <p v-if="error" class="tester-error">{{ error }}</p>
    <div class="response-output"><div class="output-label">完整响应体（原始 SSE / JSON）</div><pre><code>{{ responseText }}</code></pre></div>
  </section>
</template>

<style scoped>
.response-tester{margin:28px 0;border:1px solid var(--vp-c-divider);border-radius:8px;overflow:hidden;background:var(--vp-c-bg-soft)}.tester-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid var(--vp-c-divider);background:var(--vp-c-bg)}.tester-header span{display:block;margin-bottom:5px;color:var(--vp-c-brand-1);font:700 11px ui-monospace,monospace;letter-spacing:.1em}.tester-header strong{font-size:14px}.tester-header small{color:var(--vp-c-text-2)}.tester-form{display:grid;grid-template-columns:1.4fr 1.3fr .8fr;gap:12px;padding:18px}.tester-form label{display:flex;min-width:0;flex-direction:column;gap:6px;color:var(--vp-c-text-2);font:12px ui-monospace,monospace}.tester-form label.wide{grid-column:span 2}.tester-form input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--vp-c-divider);border-radius:5px;color:var(--vp-c-text-1);background:var(--vp-c-bg);font:13px ui-monospace,monospace}.tester-form button{align-self:end;padding:9px 12px;border:1px solid var(--vp-c-brand-1);border-radius:5px;color:var(--vp-c-white);background:var(--vp-c-brand-1);cursor:pointer;font:inherit}.tester-form button:disabled{cursor:not-allowed;opacity:.5}.tester-error{margin:0;padding:0 18px 12px;color:#c92a2a;font-size:13px}.response-output{padding:0 18px 18px}.output-label{margin-bottom:7px;color:var(--vp-c-text-2);font-size:12px}.response-output pre{max-height:440px;margin:0;padding:14px;overflow:auto;border-radius:6px;background:var(--vp-code-block-bg);white-space:pre}.response-output code{font-size:12px}@media(max-width:700px){.tester-header{align-items:flex-start;flex-direction:column}.tester-form{grid-template-columns:1fr}.tester-form label.wide{grid-column:auto}.tester-form button{width:100%}}
</style>
