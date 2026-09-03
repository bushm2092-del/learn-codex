import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'mini-codex 学习手册',
  description: '基于真实 Codex Rust 代码组织方式的中文学习文档',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '学习指南', link: '/guide/project-structure' },
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
    ],
    outline: 'deep',
    socialLinks: [],
    footer: {
      message: 'mini-codex 学习项目',
      copyright: '仅用于学习和实验',
    },
  },
})
