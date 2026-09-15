import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'mini-codex 学习手册',
  description: '基于真实 Codex Rust 代码组织方式的中文学习文档',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '从零搭建', link: '/tutorial/01-responses-protocol' },
      { text: '架构导读', link: '/guide/project-structure' },
      { text: '源码仓库', link: 'https://github.com/openai/codex' },
    ],
    sidebar: [
      {
        text: '开始学习',
        items: [
          { text: '学习路线', link: '/guide/learning-path' },
          { text: '项目组织结构', link: '/guide/project-structure' },
          { text: 'Harness 核心循环', link: '/guide/harness-core' },
        ],
      },
      {
        text: '从零搭建 mini-codex',
        collapsed: false,
        items: [
          { text: '课程总纲', link: '/tutorial/' },
          { text: '1. Harness 的本质：和 AI 玩数据', link: '/tutorial/01-responses-protocol' },
          { text: '2. 用 Rust 表达协议', link: '/tutorial/02-protocol' },
          { text: '3. Thread 与 Session', link: '/tutorial/03-thread-session' },
          { text: '4. 模型与工具循环', link: '/tutorial/04-agent-loop' },
          { text: '5. CLI 与集成测试', link: '/tutorial/05-cli-test' },
        ],
      },
    ],
    outline: 'deep',
    socialLinks: [],
    footer: {
      message: 'mini-codex 学习项目',
      copyright: '仅用于学习和实验',
    },
    search: { provider: 'local' },
  },
})
