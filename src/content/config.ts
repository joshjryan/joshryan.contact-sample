import { defineCollection, z } from 'astro:content';

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    hero_image: z.string().nullable().optional(),
  }),
});

export const collections = { pages };
