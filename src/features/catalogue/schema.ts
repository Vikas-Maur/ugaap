import { z } from "zod";

export const captureFieldSchema = z
	.object({
		id: z.string().nullable(),
		name: z.string().nullable(),
		label: z.string().nullable(),
		kind: z.enum(["text", "number", "select", "textarea", "file", "search"]),
		required: z.boolean(),
		placeholder: z.string().nullable(),
		maximumLength: z.string().nullable(),
		pattern: z.string().nullable(),
		options: z.array(z.string()).optional(),
	})
	.strict();

export const captureSnapshotSchema = z
	.object({
		authority: z.string().nullable(),
		categoryPath: z.array(z.string()),
		fields: z.array(captureFieldSchema),
		heading: z.string().nullable(),
		pathname: z.string(),
	})
	.strict();

export const captureSchema = z
	.object({
		capturedAt: z.string(),
		differences: z.unknown().nullable(),
		snapshot: captureSnapshotSchema,
	})
	.strict();

export type Capture = z.infer<typeof captureSchema>;
export type CaptureField = z.infer<typeof captureFieldSchema>;

export type CatalogueField = {
	id: string;
	label: string;
	kind: Exclude<CaptureField["kind"], "search">;
	required: boolean;
	placeholder?: string;
	maximumLength?: number;
	pattern?: string;
	options?: string[];
};

export type CatalogueForm = {
	id: string;
	version: number;
	authorityId: string;
	categoryId: string;
	categoryPath: string[];
	title: string;
	heading: string | null;
	pathname: string;
	fields: CatalogueField[];
	sourcePath: string;
	checksum: string;
	active: boolean;
};

export type CatalogueCategory = {
	id: string;
	authorityId: string;
	parentId: string | null;
	name: string;
	slug: string;
	path: string[];
	children: string[];
	navigationOptions: string[];
	formCapable: boolean;
	formId?: string;
};

export type AuthorityChunk = {
	schemaVersion: 1;
	authority: { id: string; name: string; slug: string };
	categories: CatalogueCategory[];
	forms: CatalogueForm[];
	checksum: string;
};

export type SearchEntry = {
	id: string;
	authorityId: string;
	categoryId: string;
	terms: string;
};

export type CatalogueWarning = {
	sourcePath: string;
	message: string;
	fields?: string[];
};

export type CatalogueManifest = {
	schemaVersion: 1;
	sourceCount: number;
	organizationCount: number;
	categoryCount: number;
	formCount: number;
	synthesizedFieldWarnings: number;
	synthesizedFieldCount: number;
	warnings: CatalogueWarning[];
	errors: Array<{ sourcePath: string; message: string }>;
	checksums: {
		catalogue: string;
		searchIndex: string;
		authorities: Record<string, string>;
	};
};
