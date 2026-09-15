import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import icon from "astro-icon";

export default defineConfig({
  site: "http://localhost:4321",
  output: "static",
  integrations: [react(), icon()],
});
