import type { AuthorityChunk, CatalogueField, CatalogueForm } from "../../src/features/catalogue/schema.ts";

export type RuntimeField = {
	id: string;
	label: string;
	kind: CatalogueField["kind"];
	required?: true;
	placeholder?: string;
	maximumLength?: number;
	pattern?: string;
	options?: string[];
};

export type RuntimeForm = {
	id: string;
	version?: number;
	categoryId: string;
	categoryPath: string[];
	title: string;
	fields: RuntimeField[];
};

export type RuntimeAuthority = AuthorityChunk["authority"] & {
	forms: RuntimeForm[];
};

export function runtimeField(field: CatalogueField): RuntimeField {
	return {
		id: field.id,
		label: field.label,
		kind: field.kind,
		...(field.required ? { required: true as const } : {}),
		...(field.placeholder ? { placeholder: field.placeholder } : {}),
		...(field.maximumLength ? { maximumLength: field.maximumLength } : {}),
		...(field.pattern ? { pattern: field.pattern } : {}),
		...(field.options?.length ? { options: field.options } : {}),
	};
}

export function runtimeForm(form: CatalogueForm): RuntimeForm {
	return {
		id: form.id,
		...(form.version !== 1 ? { version: form.version } : {}),
		categoryId: form.categoryId,
		categoryPath: form.categoryPath,
		title: form.title,
		fields: form.fields.map(runtimeField),
	};
}

export function runtimeAuthority(chunk: AuthorityChunk): RuntimeAuthority {
	return {
		...chunk.authority,
		forms: chunk.forms.filter((form) => form.active).map(runtimeForm),
	};
}

