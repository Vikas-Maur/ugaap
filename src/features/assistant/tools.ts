import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";

import { extractedFieldSchema } from "./schema";
import { assistantRouteDestinations } from "./routes";

const toolStatusSchema = z.enum([
	"ok",
	"requires-auth",
	"not-on-form",
	"validation-failed",
	"confirmation-required",
	"stale-review",
	"unavailable",
]);

export const listWebsiteRoutesDef = toolDefinition({
	name: "list_website_routes",
	description:
		"List UGAAP's user-facing pages, what each page is for, and whether it requires authentication.",
	inputSchema: z.object({}).strict(),
	outputSchema: z.object({
		routes: z.array(
			z.object({
				destination: z.enum(assistantRouteDestinations),
				path: z.string(),
				label: z.string(),
				purpose: z.string(),
				access: z.enum(["public", "authenticated"]),
			}),
		),
	}),
});

export const listAuthoritiesDef = toolDefinition({
	name: "list_authorities",
	description:
		"List grievance authorities directly. Use this when the citizen asks which authorities exist, without searching for a form.",
	inputSchema: z.object({}).strict(),
	outputSchema: z.object({
		authorities: z.array(
			z.object({
				slug: z.string(),
				name: z.string(),
				categoryCount: z.number().int().nonnegative(),
				formCount: z.number().int().nonnegative(),
			}),
		),
	}),
});

export const listAuthorityCategoriesDef = toolDefinition({
	name: "list_authority_categories",
	description:
		"List one level of categories under an authority without running form search. Omit parentCategoryId for top-level categories.",
	inputSchema: z
		.object({
			authoritySlug: z.string().regex(/^[a-z0-9-]+$/),
			parentCategoryId: z.string().min(1).max(240).nullable().default(null),
		})
		.strict(),
	outputSchema: z.object({
		authorityName: z.string(),
		categories: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				path: z.array(z.string()),
				hasChildren: z.boolean(),
				formId: z.string().nullable(),
			}),
		),
	}),
});

export const getWorkspaceSummaryDef = toolDefinition({
	name: "get_workspace_summary",
	description:
		"Read the signed-in citizen's own drafts, active grievance statuses, recently resolved cases, and cases needing a reply. Do not use catalogue search for status questions.",
	inputSchema: z.object({}).strict(),
	outputSchema: z.object({
		status: z.enum(["ok", "requires-auth"]),
		citizenName: z.string().nullable(),
		needsReply: z.array(z.unknown()),
		drafts: z.array(z.unknown()),
		active: z.array(z.unknown()),
		recentlyResolved: z.array(z.unknown()),
	}),
});

export const getCurrentRecordStatusDef = toolDefinition({
	name: "get_current_record_status",
	description:
		"Read the signed-in citizen's own grievance record when its detail page is currently open.",
	inputSchema: z.object({}).strict(),
	outputSchema: z.object({
		status: z.enum(["ok", "requires-auth", "unavailable"]),
		kind: z.enum(["grievance"]).nullable(),
		record: z.unknown().nullable(),
		reason: z.string(),
	}),
});

export const navigateWebsiteDef = toolDefinition({
	name: "navigate_website",
	description:
		"Navigate to a UGAAP page. Use current page context before navigating. Do not navigate away when the requested work can be completed on the current page.",
	inputSchema: z
		.object({
			destination: z.enum(assistantRouteDestinations),
			authoritySlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
			registrationId: z.string().min(1).max(120).optional(),
			publicId: z.string().min(1).max(120).optional(),
		})
		.strict(),
	outputSchema: z.object({
		status: toolStatusSchema,
		path: z.string(),
		reason: z.string(),
	}),
});

export const changeInterfaceLanguageDef = toolDefinition({
	name: "change_interface_language",
	description: "Change the UGAAP website interface language.",
	inputSchema: z.object({ language: z.enum(["en", "hi"]) }).strict(),
	outputSchema: z.object({ status: toolStatusSchema, language: z.enum(["en", "hi"]) }),
});

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

export const reviewVisibleFormDef = toolDefinition({
	name: "review_visible_form",
	description:
		"Validate the grievance form already visible and open its review screen. Never search for or reopen the form first.",
	inputSchema: z.object({}).strict(),
	outputSchema: z.object({
		status: toolStatusSchema,
		missingFields: z.array(z.string()),
		reason: z.string(),
	}),
});

export const editVisibleFormDef = toolDefinition({
	name: "edit_visible_form",
	description: "Return the currently visible grievance review to editing.",
	inputSchema: z.object({}).strict(),
	outputSchema: z.object({ status: toolStatusSchema, reason: z.string() }),
});

export const requestSubmissionConfirmationDef = toolDefinition({
	name: "request_submission_confirmation",
	description:
		"Prepare a separate final confirmation while the grievance review is visible. This does not submit the grievance.",
	inputSchema: z.object({}).strict(),
	outputSchema: z.object({
		status: toolStatusSchema,
		confirmationId: z.string().nullable(),
		reason: z.string(),
	}),
});

export const submitConfirmedGrievanceDef = toolDefinition({
	name: "submit_confirmed_grievance",
	description:
		"Submit only after the citizen explicitly confirms in a later voice or chat turn, or presses the visible confirmation button. Use the pending confirmationId exactly.",
	inputSchema: z.object({ confirmationId: z.string().min(1).max(120) }).strict(),
	outputSchema: z.object({
		status: toolStatusSchema,
		registrationId: z.string().nullable(),
		reason: z.string(),
	}),
});
