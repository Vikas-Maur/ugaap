import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import { assistantCandidateSchema, extractedFieldSchema } from "./schema";

export const searchGrievanceCatalogueDef = toolDefinition({
	name: "search_grievance_catalogue",
	description:
		"Search the real cached UGAAP grievance catalogue. Use this before naming or opening a grievance route.",
	inputSchema: z.object({ query: z.string().min(2).max(500) }).strict(),
	outputSchema: z
		.object({
			results: z.array(assistantCandidateSchema).max(5),
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
