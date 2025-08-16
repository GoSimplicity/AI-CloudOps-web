// 添加Vue文件的TypeScript模块声明
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// 添加markdown相关模块声明
declare module 'markdown-it' {
  const markdownIt: any;
  export default markdownIt;
}

declare module 'markdown-it-highlight' {
  const markdownItHighlight: any;
  export default markdownItHighlight;
}
