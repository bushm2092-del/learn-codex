<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { gsap } from 'gsap'

const steps = [
  ['用户发送', 'UserTurn：查看目录并判断项目语言'],
  ['组装 Prompt', 'instructions + input + tools'],
  ['模型调用', 'function_call：exec_command(ls)'],
  ['工具执行', 'ToolResult：Cargo.toml / crates / README.md'],
  ['结果回灌', 'function_call_output → 再次请求 AI'],
  ['最终回答', 'message：这是一个 Rust 项目'],
]
const active = ref(0)
const playing = ref(false)
const packet = ref<HTMLElement | null>(null)
const tl = ref<gsap.core.Timeline | null>(null)

function reset() {
  active.value = 0
  if (packet.value) gsap.set(packet.value, { x: 0 })
}
function play() {
  tl.value?.kill()
  reset()
  tl.value = gsap.timeline({ repeat: -1, repeatDelay: 0.8, onStart: () => (playing.value = true), onPause: () => (playing.value = false) })
  steps.forEach((_, index) => {
    tl.value?.call(() => (active.value = index))
      .to(packet.value, { x: index === steps.length - 1 ? 0 : 88, duration: 0.6, ease: 'power2.inOut' })
  })
}
function toggle() {
  if (!tl.value) play()
  else if (tl.value.paused()) { tl.value.play(); playing.value = true }
  else { tl.value.pause(); playing.value = false }
}
onMounted(play)
onBeforeUnmount(() => tl.value?.kill())
</script>

<template>
  <section class="agent-loop" aria-label="最小 Agent Loop 动画">
    <header><div><span>AGENT LOOP / LIVE</span><strong>一次真实对话如何变成数据循环</strong></div><div class="actions"><button type="button" @click="toggle">{{ playing ? '暂停' : '播放' }}</button><button type="button" @click="play">重播</button></div></header>
    <div class="conversation">
      <div class="chat"><small>对话窗口</small><p class="user">用户：请帮我查看当前目录有哪些文件，并告诉我项目使用什么语言。</p><p v-if="active >= 2" class="call">AI：调用 exec_command，命令：ls</p><p v-if="active >= 3" class="tool">工具结果：Cargo.toml、crates、README.md</p><p v-if="active >= 5" class="answer">AI：当前目录是一个 Rust 项目。</p></div>
      <div class="flow"><small>Harness 数据流</small><div class="nodes"><button v-for="(step, index) in steps" :key="step[0]" type="button" :class="{ active: active === index }" @click="active = index"><b>0{{ index + 1 }}</b>{{ step[0] }}</button></div><div class="rail"><i ref="packet">data</i></div><div class="payload"><b>{{ steps[active][0] }}</b><code>{{ steps[active][1] }}</code></div></div>
    </div>
  </section>
</template>

<style scoped>
.agent-loop{margin:28px 0;border:1px solid var(--vp-c-divider);border-radius:8px;overflow:hidden;background:var(--vp-c-bg-soft)}header{display:flex;justify-content:space-between;gap:16px;padding:18px 20px;border-bottom:1px solid var(--vp-c-divider);background:var(--vp-c-bg)}header span{display:block;margin-bottom:5px;color:var(--vp-c-brand-1);font:700 11px ui-monospace,monospace;letter-spacing:.1em}header strong{font-size:14px}.actions{display:flex;gap:8px}.actions button{padding:7px 12px;border:1px solid var(--vp-c-brand-1);border-radius:6px;color:var(--vp-c-white);background:var(--vp-c-brand-1);cursor:pointer;font:inherit}.actions button+button{color:var(--vp-c-brand-1);background:transparent}.conversation{display:grid;grid-template-columns:1fr 1.1fr}.chat,.flow{min-height:320px;padding:20px}.chat{border-right:1px solid var(--vp-c-divider);background:var(--vp-c-bg)}small{display:block;margin-bottom:16px;color:var(--vp-c-text-2);font-size:12px;font-weight:700}.chat p{margin:12px 0;padding:11px 13px;border:1px solid var(--vp-c-divider);border-radius:7px;line-height:1.5}.chat .user{margin-left:8%;background:var(--vp-c-brand-soft)}.chat .call{background:#fff7ed}.chat .tool{background:#f0fdf4}.chat .answer{background:var(--vp-c-bg-soft)}.nodes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.nodes button{min-height:56px;padding:7px;border:1px solid var(--vp-c-divider);border-radius:6px;color:var(--vp-c-text-2);background:var(--vp-c-bg);cursor:pointer;font:inherit}.nodes button.active,.nodes button:hover{border-color:var(--vp-c-brand-1);color:var(--vp-c-brand-1);background:var(--vp-c-brand-soft)}.nodes b{display:block;margin-bottom:3px;font:11px ui-monospace,monospace}.rail{position:relative;height:72px;margin:28px 8% 0;border-top:2px solid var(--vp-c-brand-1)}.rail:before,.rail:after{position:absolute;top:-8px;color:var(--vp-c-brand-1);content:'•';font-size:20px}.rail:before{left:-6px}.rail:after{right:-6px}.rail i{position:absolute;top:-14px;left:0;padding:4px 8px;border-radius:4px;color:var(--vp-c-brand-1);background:var(--vp-c-brand-soft);font:11px ui-monospace,monospace;font-style:normal}.payload{padding:12px;border:1px dashed var(--vp-c-brand-1);border-radius:6px}.payload b{display:block;margin-bottom:8px;color:var(--vp-c-brand-1)}.payload code{white-space:pre-wrap}@media(max-width:760px){header{align-items:flex-start;flex-direction:column}.conversation{grid-template-columns:1fr}.chat{border-right:0;border-bottom:1px solid var(--vp-c-divider)}.chat,.flow{min-height:auto;padding:16px}}@media(max-width:480px){.nodes{grid-template-columns:repeat(2,1fr)}}
</style>
