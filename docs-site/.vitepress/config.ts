import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'AgentOps Desktop',
  description: 'Cross-platform desktop app to orchestrate CLI agents, coding assistants, and automation workflows',
  base: '/agentops-desktop/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/architecture-template' },
      { text: 'Security', link: '/SECURITY-REVIEW' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Vision', link: '/vision-template' },
          { text: 'Architecture', link: '/architecture-template' },
          { text: 'Tech Stack', link: '/tech-stack-template' },
        ]
      },
      {
        text: 'Development',
        items: [
          { text: 'Git Workflow', link: '/git-workflow' },
          { text: 'PR Conventions', link: '/pr-conventions' },
          { text: 'CI/CD', link: '/ci-cd' },
          { text: 'Design System', link: '/DESIGN-SYSTEM' },
        ]
      },
      {
        text: 'Quality',
        items: [
          { text: 'Security Review', link: '/SECURITY-REVIEW' },
          { text: 'Accessibility Audit', link: '/ACCESSIBILITY-AUDIT' },
          { text: 'Error Recovery', link: '/ERROR-RECOVERY-SPEC' },
          { text: 'Monitoring', link: '/monitoring-template' },
        ]
      },
      {
        text: 'Planning',
        items: [
          { text: 'Backlog Process', link: '/backlog-process' },
          { text: 'Backlog Template', link: '/backlog-template' },
          { text: 'Market Analysis', link: '/market-analysis-template' },
          { text: 'Competitive Analysis', link: '/competitive-analysis' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/cmpa/agentops-desktop' }
    ]
  },

  srcDir: '../docs',

  cleanUrls: true,

  lastUpdated: true,
})
