import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const projectName = 'Typeorm Extensions';
const repositoryName = 'typeorm-extensions';
const packageName = repositoryName;
const organizationName = 'koenigstag';

const projectFolder = __dirname;

const config: Config = {
  title: projectName,
  tagline: 'Additional functionality and extensions for the TypeORM',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: `https:/${organizationName}.github.io`,
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: `/${repositoryName}`,
  trailingSlash: true,

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: organizationName, // Usually your GitHub org/user name.
  projectName: repositoryName, // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove th'typeorm-extensions'e "edit this page" links.
          editUrl:
            `https://github.com/${organizationName}/${repositoryName}/tree/main/${projectFolder}/docs/`,
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            `https://github.com/${organizationName}/${repositoryName}/tree/main/${projectFolder}/blog/`,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: projectName,
      logo: {
        alt: `${projectName} Logo`,
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'getting-started/overview',
          position: 'left',
          label: 'Docs',
      },
      {
          type: 'doc',
          docId: 'api/core/index',
          label: 'API',
          position: 'left',
      },
        {
          href: `https://github.com/${organizationName}/${repositoryName}`,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting started',
              to: '/docs/getting-started/overview',
            },
            {
              label: 'API',
              to: '/docs/api/core/',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: `https://stackoverflow.com/questions/tagged/${packageName}`,
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: `https://github.com/${organizationName}/${repositoryName}`,
            },
            {
              label: 'NPM',
              href: `https://npmjs.com/package/${packageName}`,
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} ${projectName}, Inc. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
