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
