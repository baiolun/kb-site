import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";

// 发布目标：GitHub Pages 项目站 https://baiolun.github.io/kb-site/
// base 无尾斜杠：import.meta.env.BASE_URL 返回 "/kb-site"
const site = "https://baiolun.github.io";
const base = "/kb-site";

export default defineConfig({
  site,
  base,
  output: "static",
  integrations: [react(), icon(), sitemap()],
});
