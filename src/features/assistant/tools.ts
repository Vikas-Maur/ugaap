import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import { extractedFieldSchema } from "./schema";

export const assistantSearchResultSchema = z
	.object({
		id: z.string().min(1).max(240),
		authoritySlug: z.string().regex(/^[a-z0-9-]+$/),
		authorityName: z.string().min(1).max(240),
		categoryId: z.string().max(240).nullable(),
		title: z.string().min(1).max(320),
		categoryPath: z.array(z.string().max(240)).max(16),
	})
	.strict();

export const searchGrievanceCatalogueDef = toolDefinition({
	name: "search_grievance_catalogue",
	description:
		"Search the real cached UGAAP grievance catalogue. Use this before naming or opening a grievance route.",
	inputSchema: z
		.object({
			query: z.string().min(2).max(500),
			authoritySlugs: z
				.array(z.string().regex(/^[a-z0-9-]+$/))
				.max(12)
				.optional(),
			categoryIds: z.array(z.string().min(1).max(240)).max(20).optional(),
			page: z.number().int().min(1).max(100).default(1),
			pageSize: z.number().int().min(1).max(20).default(10),
		})
		.strict(),
	outputSchema: z
		.object({
			normalizedQuery: z.string(),
			indexVersion: z.string(),
			results: z.array(assistantSearchResultSchema).max(20),
			total: z.number().int().min(0),
			page: z.number().int().min(1),
			pageSize: z.number().int().min(1).max(20),
			hasMore: z.boolean(),
			facets: z
				.object({
					authorities: z.record(z.string(), z.number().int().min(0)),
					categories: z.record(z.string(), z.number().int().min(0)),
				})
				.strict(),
			status: z.enum(["found", "not-found"]),
			catalogueOnly: z.literal(true),
		})
		.strict(),
});

export const openGrievanceFormDef = toolDefinition({
	name: "open_grievance_form",
	description:
		"Open a verified grievance form after the citizen explicitly asks to continue with a search result.",
	inputSchema: z
		.object({
			authoritySlug: z.string().regex(/^[a-z0-9-]+$/),
			formId: z.string().min(1).max(180),
		})
		.strict(),
	outputSchema: z
		.object({
			opened: z.boolean(),
			requiresLogin: z.boolean(),
			reason: z.string(),
		})
		.strict(),
});

export const fillVisibleFormDef = toolDefinition({
	name: "fill_visible_form",
	description:
		"Fill verified non-file fields on the grievance form currently visible to a signed-in citizen. Infer the matching internal fieldId from the supplied live form context; the citizen may describe a value naturally and never needs to know exact labels or IDs. Use only values the citizen supplied.",
	inputSchema: z
		.object({ fields: z.array(extractedFieldSchema).min(1).max(20) })
		.strict(),
	outputSchema: z
		.object({
			applied: z.number().int().min(0),
			rejected: z.number().int().min(0),
		})
		.strict(),
});
