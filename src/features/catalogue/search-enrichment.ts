import { z } from "zod";

export const searchEnrichmentItemSchema = z
	.object({
		id: z.string().min(1).max(240),
		aliases: z.array(z.string().min(1).max(120)).max(20),
		keywords: z.array(z.string().min(1).max(120)).max(20),
		phrases: z.array(z.string().min(1).max(180)).max(12),
	})
	.strict();

export const searchEnrichmentSchema = z
	.object({
		schemaVersion: z.literal(1),
		sourceChecksum: z.string().length(64),
		generatedAt: z.string(),
		items: z.array(searchEnrichmentItemSchema),
	})
	.strict();

export type SearchEnrichment = z.infer<typeof searchEnrichmentSchema>;
