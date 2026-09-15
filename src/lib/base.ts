// 站点 base 前缀单点出口（GitHub Pages 项目子路径 /kb-site/）。
// Astro 的 base 配置不自动作用于手写 <a href>，必须经 withBase 包一层。
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const withBase = (p: string) => (p.startsWith("/") ? `${BASE}${p}` : p);
