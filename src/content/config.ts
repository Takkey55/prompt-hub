import { defineCollection, z } from 'astro:content';

const promptsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum([
      'SEO・ブログ',
      'SNS・X運用',
      'LP・コピーライティング',
      'Claude Code自動化',
      'ディレクション',
    ]),
    targetModel: z.string(),
    timeSaved: z.string(),
    promptText: z.string(),
    noteUrl: z.string().optional(),
    pubDate: z.date(),
  }),
});

export const collections = {
  prompts: promptsCollection,
};
