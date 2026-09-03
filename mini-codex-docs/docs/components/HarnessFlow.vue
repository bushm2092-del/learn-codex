<script setup lang="ts">
import { computed, ref } from 'vue'

const steps = [
  { title: '提交任务', owner: 'CodexThread', file: 'core/src/codex_thread.rs', detail: '把 UserTurn 包装成带 submission_id 的 Submission，并写入 Tokio channel。', data: 'Op::UserTurn { text }' },
  { title: '接收任务', owner: 'Session', file: 'core/src/session/session.rs', detail: 'submission_loop 持续读取操作，并把用户回合交给 run_turn。', data: 'Submission { id, op }' },
  { title: '请求模型', owner: 'ModelClient', file: 'core/src/session/turn.rs', detail: '组合历史、system instructions 和工具定义，发起一次流式模型请求。', data: 'Prompt { input, tools, instructions }' },
  { title: '执行工具', owner: 'ToolRouter', file: 'core/src/tools/router.rs', detail: '根据 function_call 的工具名查找实现，并在当前工作目录执行。', data: 'dispatch(name, arguments, cwd)' },
  { title: '回灌结果', owner: 'ContextManager', file: 'core/src/context_manager.rs', detail: '将工具结果记录为 function_call_output，再次请求模型，直到不再需要工具。', data: 'function_call_output' },
]

const activeIndex = ref(0)
const active = computed(() => steps[activeIndex.value])
</script>

<template>
  <section class="harness-flow" aria-label="Harness 执行流程演示">
    <div class="step-list" role="tablist" aria-label="执行步骤">
      <button v-for="(step, index) in steps" :key="step.title" class="step-button" :class="{ active: activeIndex === index }" type="button" role="tab" :aria-selected="activeIndex === index" @click="activeIndex = index">
        <span class="step-number">{{ index + 1 }}</span><span>{{ step.title }}</span>
      </button>
    </div>
    <div class="step-detail" role="tabpanel" aria-live="polite">
      <div class="detail-heading"><span class="owner">{{ active.owner }}</span><code>{{ active.file }}</code></div>
      <p>{{ active.detail }}</p>
      <pre><code>{{ active.data }}</code></pre>
    </div>
  </section>
</template>

<style scoped>
.harness-flow { margin: 24px 0; border: 1px solid var(--vp-c-divider); border-radius: 8px; overflow: hidden; background: var(--vp-c-bg-soft); }
.step-list { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border-bottom: 1px solid var(--vp-c-divider); }
.step-button { min-height: 72px; padding: 10px 8px; border: 0; border-right: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); background: var(--vp-c-bg); cursor: pointer; font: inherit; letter-spacing: 0; }
.step-button:last-child { border-right: 0; }
.step-button:hover, .step-button.active { color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
.step-button.active { box-shadow: inset 0 -3px 0 var(--vp-c-brand-1); }
.step-number { display: block; width: 24px; height: 24px; margin: 0 auto 6px; border: 1px solid currentColor; border-radius: 50%; line-height: 22px; }
.step-detail { min-height: 190px; padding: 22px; }
.detail-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.owner { color: var(--vp-c-brand-1); font-weight: 700; }
.step-detail p { margin: 16px 0; }
.step-detail pre { margin: 0; padding: 12px 14px; overflow-x: auto; border-radius: 6px; background: var(--vp-code-block-bg); }
@media (max-width: 700px) {
  .step-list { grid-template-columns: 1fr; }
  .step-button { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 8px 12px; border-right: 0; border-bottom: 1px solid var(--vp-c-divider); text-align: left; }
  .step-button.active { box-shadow: inset 3px 0 0 var(--vp-c-brand-1); }
  .step-number { flex: 0 0 24px; margin: 0; text-align: center; }
  .step-detail { min-height: 210px; padding: 18px; }
}
</style>
