import { z } from "zod";

export const assistantLanguageSchema = z.enum(["en", "hi"]);

export const assistantTranscriptionRequestSchema = z
	.object({
		audio: z.string().min(1).max(2_800_000),
		mimeType: z.literal("audio/wav"),
	})
	.strict();

export const assistantTranscriptionSchema = z
	.object({
		transcript: z.string().max(4_000),
		language: assistantLanguageSchema,
	})
	.strict();

export const assistantCandidateSchema = z
	.object({
		formId: z.string().min(1).max(180),
		authoritySlug: z.string().regex(/^[a-z0-9-]+$/),
		authorityName: z.string().min(1).max(240),
		title: z.string().min(1).max(320),
		categoryPath: z.array(z.string().max(240)).max(16),
	})
	.strict();

export type AssistantCandidate = z.infer<typeof assistantCandidateSchema>;

export const extractedFieldSchema = z
	.object({
		fieldId: z.string().min(1).max(180),
		value: z.string().max(4_000),
	})
	.strict();

export const assistantTurnSchema = z
	.object({
		inputTranscript: z.string().min(1).max(4_000).nullable(),
		message: z.string().min(1).max(1_200),
		intent: z.enum([
			"classify",
			"clarify",
			"navigate",
			"fill-form",
			"public-information",
			"login-required",
			"unsupported",
		]),
		formId: z.string().max(180).nullable(),
		authoritySlug: z.string().max(180).nullable(),
		formTitle: z.string().max(320).nullable(),
		authorityName: z.string().max(240).nullable(),
		confidence: z.number().min(0).max(1),
		extractedFields: z.array(extractedFieldSchema).max(20),
		missingRequiredFields: z.array(z.string().max(180)).max(20),
		followUpQuestion: z.string().max(500).nullable(),
		plainLanguageReason: z.string().max(700),
	})
	.strict();

export type AssistantTurn = z.infer<typeof assistantTurnSchema>;

const wireMessageSchema = z
	.object({
		id: z.string().max(200).optional(),
		role: z.enum(["user", "assistant", "system", "tool"]),
		parts: z.array(z.unknown()).max(40).optional(),
		content: z.unknown().optional(),
	})
	.passthrough();

export const assistantChatRequestSchema = z
	.object({
		messages: z.array(wireMessageSchema).min(1).max(30),
		forwardedProps: z
			.object({
				language: assistantLanguageSchema.default("en"),
				messageLanguage: assistantLanguageSchema.nullable().default(null),
				pathname: z.string().max(500).default("/"),
				route: z
					.object({
						destination: z.string().max(80),
						label: z.string().max(160),
						purpose: z.string().max(500),
						access: z.enum(["public", "authenticated"]),
					})
					.strict()
					.nullable()
					.default(null),
				currentForm: z
					.object({
						id: z.string().max(180),
						title: z.string().max(320),
						heading: z.string().max(320).nullable(),
						categoryPath: z.array(z.string().max(240)).max(16),
						stage: z.enum(["edit", "review"]),
						fields: z
							.array(
								z
									.object({
										id: z.string().max(180),
										label: z.string().max(240),
										kind: z.string().max(40),
										required: z.boolean(),
										placeholder: z.string().max(500).optional(),
										maximumLength: z.number().int().positive().optional(),
										pattern: z.string().max(500).optional(),
										options: z.array(z.string().max(240)).max(100).optional(),
										value: z.string().max(4_000),
										error: z.string().max(500).nullable(),
									})
									.strict(),
							)
							.max(40),
					})
					.strict()
					.nullable()
					.default(null),
				pageContent: z.string().max(8_000).default(""),
			})
			.strict()
			.default({
				language: "en",
				messageLanguage: null,
				pathname: "/",
				route: null,
				currentForm: null,
				pageContent: "",
			}),
		threadId: z.string().max(200).optional(),
		runId: z.string().max(200).optional(),
		state: z.unknown().optional(),
		tools: z.array(z.unknown()).max(20).optional(),
		context: z.array(z.unknown()).max(20).optional(),
		data: z.unknown().optional(),
	})
	.passthrough();
