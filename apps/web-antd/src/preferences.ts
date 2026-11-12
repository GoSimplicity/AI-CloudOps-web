import { defineOverridesPreferences } from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    // accessMode: 'backend',
    accessMode: 'frontend',
    compact: true,
    enableRefreshToken: true,
    locale: 'zh-CN',
    name: import.meta.env.VITE_APP_TITLE,
  },
  copyright: {
    companyName: 'AI-CloudOps',
    companySiteLink: 'https://github.com/GoSimplicity/AI-CloudOps-web',
    date: String(new Date().getFullYear()),
  },
  logo: {
    source: `${import.meta.env.BASE_URL}cloudops.svg`,
  },
  tabbar: {
    // 确保页面缓存功能启用，避免切换页面时重新加载
    keepAlive: true,
  },
  theme: {
    colorPrimary: 'hsl(205 84% 39%)',
    mode: 'light',
  },
});
