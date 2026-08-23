import { useCallback, useEffect, useMemo, useState } from "react";

import { useI18n } from "#/features/i18n/i18n";
import type { CatalogueField, CatalogueForm } from "./schema";

export type FormValues = Record<string, string>;
export type AttachmentState = Record<string, string[]>;
export type FormErrors = Record<string, string>;

export type StoredFormState = {
	values: FormValues;
	attachments: AttachmentState;
	updatedAt: string;
};

export type FormStateRestore = Pick<StoredFormState, "values" | "attachments">;

const STORAGE_PREFIX = "ugaap-catalogue-form:";

function storageKey(formId: string) {
	return `${STORAGE_PREFIX}${formId}`;
}

function readStoredState(formId: string): StoredFormState | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(storageKey(formId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as StoredFormState;
		if (!parsed || typeof parsed !== "object" || !parsed.values) return null;
		return {
			values: parsed.values,
			attachments: parsed.attachments ?? {},
			updatedAt: parsed.updatedAt ?? new Date().toISOString(),
		};
	} catch {
		return null;
	}
}

function initialValues(form: CatalogueForm): FormValues {
	return Object.fromEntries(form.fields.map((field) => [field.id, ""]));
}

export function validateForm(
	form: CatalogueForm,
	values: FormValues,
	attachments: AttachmentState = {},
	language: "en" | "hi" = "en",
): FormErrors {
	const errors: FormErrors = {};
	for (const field of form.fields) {
		const value = values[field.id] ?? "";
		const hasValue =
			field.kind === "file"
				? Boolean(attachments[field.id]?.length)
				: Boolean(value.trim());
		if (field.required && !hasValue) {
			errors[field.id] =
				language === "hi" ? "यह फ़ील्ड ज़रूरी है।" : "This field is required.";
			continue;
		}
		if (field.maximumLength && value.length > field.maximumLength) {
			errors[field.id] =
				language === "hi"
					? `${field.maximumLength} अक्षरों तक लिखें।`
					: `Use ${field.maximumLength} characters or fewer.`;
			continue;
		}
		if (field.pattern && value && !safePatternTest(field.pattern, value)) {
			errors[field.id] =
				language === "hi"
					? "फ़ील्ड में दिया गया प्रारूप रखें।"
					: "Use the format shown in the field.";
		}
	}
	return errors;
}

function safePatternTest(pattern: string, value: string) {
	try {
		return new RegExp(pattern).test(value);
	} catch {
		return true;
	}
}

export function useCatalogueFormState(form: CatalogueForm) {
	const { language } = useI18n();
	const [state, setState] = useState<StoredFormState>(() => {
		const stored = readStoredState(form.id);
		return (
			stored ?? {
				values: initialValues(form),
				attachments: {},
				updatedAt: new Date().toISOString(),
			}
		);
	});
	const [errors, setErrors] = useState<FormErrors>({});
	const [hasValidated, setHasValidated] = useState(false);

	useEffect(() => {
		const stored = readStoredState(form.id);
		setState(
			stored ?? {
				values: initialValues(form),
				attachments: {},
				updatedAt: new Date().toISOString(),
			},
		);
		setErrors({});
		setHasValidated(false);
	}, [form]);

	useEffect(() => {
		if (!hasValidated) return;
		setErrors(validateForm(form, state.values, state.attachments, language));
	}, [form, hasValidated, language, state.attachments, state.values]);

	useEffect(() => {
		if (typeof window === "undefined") return;
		try {
			window.localStorage.setItem(storageKey(form.id), JSON.stringify(state));
		} catch {
			// Recovery is best effort. The form continues to work if storage is unavailable.
		}
	}, [form.id, state]);

	const setValue = useCallback((fieldId: string, value: string) => {
		setState((current) => ({
			...current,
			values: { ...current.values, [fieldId]: value },
			updatedAt: new Date().toISOString(),
		}));
		setErrors((current) => {
			if (!current[fieldId]) return current;
			const next = { ...current };
			delete next[fieldId];
			return next;
		});
	}, []);

	const setAttachment = useCallback((fieldId: string, names: string[]) => {
		setState((current) => ({
			...current,
			attachments: { ...current.attachments, [fieldId]: names },
			updatedAt: new Date().toISOString(),
		}));
	}, []);

	const restore = useCallback((restored: FormStateRestore) => {
		setState({
			values: restored.values,
			attachments: restored.attachments,
			updatedAt: new Date().toISOString(),
		});
		setErrors({});
		setHasValidated(false);
	}, []);

	const validate = useCallback(() => {
		const next = validateForm(form, state.values, state.attachments, language);
		setErrors(next);
		setHasValidated(true);
		return Object.keys(next).length === 0;
	}, [form, language, state.attachments, state.values]);

	const reset = useCallback(() => {
		setState({
			values: initialValues(form),
			attachments: {},
			updatedAt: new Date().toISOString(),
		});
		setErrors({});
		setHasValidated(false);
		if (typeof window !== "undefined")
			window.localStorage.removeItem(storageKey(form.id));
	}, [form]);

	return useMemo(
		() => ({
			...state,
			errors,
			setValue,
			setAttachment,
			restore,
			validate,
			reset,
		}),
		[errors, reset, restore, setAttachment, setValue, state, validate],
	);
}

export function fieldHasValue(
	field: CatalogueField,
	values: FormValues,
	attachments: AttachmentState,
) {
	return field.kind === "file"
		? Boolean(attachments[field.id]?.length)
		: Boolean(values[field.id]?.trim());
}
