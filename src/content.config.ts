import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro:content";

// vault 内容集合：由 pipeline/parse-vault.mjs 生成（勿手改 src/content/）
const vault = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/vault" }),
  schema: z.object({
    title: z.string(),
    domain: z.string(),
    originalPath: z.string(),
    tags: z.array(z.string()).default([]),
    aliases: z.array(z.string()).default([]),
    created: z.string().optional(),
    status: z.string().optional(),
    collection: z.enum(["notes", "annotations"]).default("notes"),
    toc: z.array(z.object({ t: z.string(), id: z.string() })).default([]),
  }),
});

export const collections = { vault };
