import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "http://localhost:4321",
  output: "static",
  integrations: [react()],
});
