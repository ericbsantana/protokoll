import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'protokoll',
  titleTemplate: ':title · protokoll',
  description: 'EC-VRF oracle for EVM chains - verifiable randomness built from first principles',

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        href: 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap',
        rel: 'stylesheet',
      },
    ],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' }],
    ['link', { rel: 'alternate icon', type: 'image/x-icon', href: '/favicon.ico' }]
  ],

  srcExclude: ['theory/**', 'ideas/**', 'project.md'],

  sitemap: {
    hostname: 'https://protokoll.dev',
  },

  markdown: {
    math: true,
  },

  vite: {
    server: {
      fs: {
        // Let the /demo page import generateOracleProof from src/oracle/proof.ts.
        allow: ['..'],
      },
    },
  },

  themeConfig: {
    nav: [
      { text: 'Whitepaper', link: '/whitepaper' },
      { text: 'Concepts', link: '/concepts' },
      {
        text: 'Guide',
        items: [
          { text: 'Integration', link: '/guide/integration' },
          { text: 'Self-Hosting', link: '/guide/self-hosting' },
          { text: 'Deployments', link: '/guide/deployments' },
        ],
      },
      { text: 'Roadmap', link: '/roadmap' },
      {
        text: 'GitHub',
        link: 'https://github.com/ericbsantana/protokoll',
        target: '_blank',
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Integration', link: '/guide/integration' },
            { text: 'Self-Hosting', link: '/guide/self-hosting' },
            { text: 'Deployments', link: '/guide/deployments' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
    },

    outline: {
      level: [2, 3],
      label: 'On this page',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 protokoll contributors',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ericbsantana/protokoll' },
    ],
  },
})
