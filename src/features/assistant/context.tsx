import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

import type {
	CatalogueField,
	CatalogueForm,
} from "#/features/catalogue/schema";
import type { ExtractedField } from "./types";

type RegisteredForm = {
	form: CatalogueForm;
	values: Record<string, string>;
	setValue: (fieldId: string, value: string) => void;
};

type AssistantContextValue = {
	currentForm: RegisteredForm | null;
	registerForm: (registration: RegisteredForm | null) => void;
	applyFields: (fields: ExtractedField[]) => {
		applied: number;
		rejected: number;
	};
	undoLastFill: () => void;
	canUndo: boolean;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

function validFieldValue(field: CatalogueField, value: string) {
	if (field.kind === "file") return false;
	if (field.maximumLength && value.length > field.maximumLength) return false;
	if (field.options?.length && !field.options.includes(value)) return false;
	if (field.pattern) {
		try {
			if (!new RegExp(field.pattern).test(value)) return false;
		} catch {
			// Invalid source patterns are ignored consistently with manual validation.
		}
	}
	return true;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
	const [currentForm, setCurrentForm] = useState<RegisteredForm | null>(null);
	const [undoValues, setUndoValues] = useState<Record<string, string> | null>(
		null,
	);

	const registerForm = useCallback((registration: RegisteredForm | null) => {
		setCurrentForm(registration);
		if (!registration) setUndoValues(null);
	}, []);

	const applyFields = useCallback(
		(fields: ExtractedField[]) => {
			if (!currentForm) return { applied: 0, rejected: fields.length };
			const fieldById = new Map(
				currentForm.form.fields.map((field) => [field.id, field]),
			);
			const previous: Record<string, string> = {};
			let applied = 0;
			let rejected = 0;
			for (const item of fields) {
				const field = fieldById.get(item.fieldId);
				if (!field || !validFieldValue(field, item.value)) {
					rejected += 1;
					continue;
				}
				previous[item.fieldId] = currentForm.values[item.fieldId] ?? "";
				currentForm.setValue(item.fieldId, item.value);
				applied += 1;
			}
			setUndoValues(applied ? previous : null);
			return { applied, rejected };
		},
		[currentForm],
	);

	const undoLastFill = useCallback(() => {
		if (!currentForm || !undoValues) return;
		for (const [fieldId, value] of Object.entries(undoValues))
			currentForm.setValue(fieldId, value);
		setUndoValues(null);
	}, [currentForm, undoValues]);

	const value = useMemo(
		() => ({
			currentForm,
			registerForm,
			applyFields,
			undoLastFill,
			canUndo: Boolean(undoValues),
		}),
		[applyFields, currentForm, registerForm, undoLastFill, undoValues],
	);
	return (
		<AssistantContext.Provider value={value}>
			{children}
		</AssistantContext.Provider>
	);
}

export function useAssistantContext() {
	const value = useContext(AssistantContext);
	if (!value)
		throw new Error(
			"useAssistantContext must be used inside AssistantProvider.",
		);
	return value;
}
