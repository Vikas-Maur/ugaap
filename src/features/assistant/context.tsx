import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useMemo,
	useRef,
	useState,
} from "react";

import type { CatalogueField, CatalogueForm } from "#/features/catalogue/schema";
import type { ExtractedField } from "./types";

export type AssistantWorkflowResult = {
	status:
		| "ok"
		| "not-on-form"
		| "validation-failed"
		| "confirmation-required"
		| "stale-review"
		| "unavailable";
	reason: string;
	missingFields?: string[];
	confirmationId?: string | null;
	registrationId?: string | null;
};

export type RegisteredForm = {
	form: CatalogueForm;
	values: Record<string, string>;
	errors: Record<string, string>;
	stage: "edit" | "review";
	revision: string;
	setValue: (fieldId: string, value: string) => void;
	openReview: () => Promise<{ opened: boolean; missingFields: string[] }>;
	openEdit: () => void;
	submit: () => Promise<{ registrationId: string }>;
};

export type PendingSubmission = {
	id: string;
	formTitle: string;
	requestedTurn: number;
};

type AssistantContextValue = {
	currentForm: RegisteredForm | null;
	registerForm: (registration: RegisteredForm | null) => void;
	applyFields: (fields: ExtractedField[]) => { applied: number; rejected: number };
	undoLastFill: () => void;
	canUndo: boolean;
	beginUserTurn: () => number;
	reviewVisibleForm: () => Promise<AssistantWorkflowResult>;
	editVisibleForm: () => AssistantWorkflowResult;
	requestSubmissionConfirmation: () => AssistantWorkflowResult;
	submitConfirmedGrievance: (
		confirmationId: string,
		options?: { allowCurrentTurn?: boolean },
	) => Promise<AssistantWorkflowResult>;
	pendingSubmission: PendingSubmission | null;
	cancelPendingSubmission: () => void;
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

function createConfirmationId() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto)
		return crypto.randomUUID();
	return `confirmation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AssistantProvider({ children }: { children: ReactNode }) {
	const [currentForm, setCurrentForm] = useState<RegisteredForm | null>(null);
	const [undoValues, setUndoValues] = useState<Record<string, string> | null>(null);
	const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission | null>(null);
	const pendingRevisionRef = useRef<string | null>(null);
	const turnRef = useRef(0);

	const cancelPendingSubmission = useCallback(() => {
		pendingRevisionRef.current = null;
		setPendingSubmission(null);
	}, []);

	const registerForm = useCallback((registration: RegisteredForm | null) => {
		setCurrentForm(registration);
		if (!registration) {
			setUndoValues(null);
			pendingRevisionRef.current = null;
			setPendingSubmission(null);
			return;
		}
		setPendingSubmission((pending) => {
			if (
				pending &&
				(registration.stage !== "review" ||
					pendingRevisionRef.current !== registration.revision)
			) {
				pendingRevisionRef.current = null;
				return null;
			}
			return pending;
		});
	}, []);

	const applyFields = useCallback(
		(fields: ExtractedField[]) => {
			if (!currentForm || currentForm.stage !== "edit")
				return { applied: 0, rejected: fields.length };
			const fieldById = new Map(currentForm.form.fields.map((field) => [field.id, field]));
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
			if (applied) cancelPendingSubmission();
			return { applied, rejected };
		},
		[cancelPendingSubmission, currentForm],
	);

	const undoLastFill = useCallback(() => {
		if (!currentForm || !undoValues) return;
		for (const [fieldId, value] of Object.entries(undoValues)) currentForm.setValue(fieldId, value);
		setUndoValues(null);
		cancelPendingSubmission();
	}, [cancelPendingSubmission, currentForm, undoValues]);

	const beginUserTurn = useCallback(() => {
		turnRef.current += 1;
		return turnRef.current;
	}, []);

	const reviewVisibleForm = useCallback(async (): Promise<AssistantWorkflowResult> => {
		if (!currentForm) return { status: "not-on-form", reason: "No grievance form is visible." };
		if (currentForm.stage === "review")
			return { status: "ok", reason: "The grievance review is already visible." };
		const result = await currentForm.openReview();
		return result.opened
			? { status: "ok", reason: "The grievance review is now visible." }
			: {
					status: "validation-failed",
					reason: "Required or invalid form fields must be fixed first.",
					missingFields: result.missingFields,
				};
	}, [currentForm]);

	const editVisibleForm = useCallback((): AssistantWorkflowResult => {
		if (!currentForm) return { status: "not-on-form", reason: "No grievance form is visible." };
		if (currentForm.stage === "edit")
			return { status: "ok", reason: "The form is already open for editing." };
		cancelPendingSubmission();
		currentForm.openEdit();
		return { status: "ok", reason: "The form is open for editing." };
	}, [cancelPendingSubmission, currentForm]);

	const requestSubmissionConfirmation = useCallback((): AssistantWorkflowResult => {
		if (!currentForm || currentForm.stage !== "review")
			return {
				status: "not-on-form",
				reason: "Open the completed grievance review before requesting confirmation.",
				confirmationId: null,
			};
		const id = createConfirmationId();
		pendingRevisionRef.current = currentForm.revision;
		setPendingSubmission({ id, formTitle: currentForm.form.title, requestedTurn: turnRef.current });
		return {
			status: "confirmation-required",
			reason: "The citizen must explicitly confirm this reviewed grievance.",
			confirmationId: id,
		};
	}, [currentForm]);

	const submitConfirmedGrievance = useCallback(
		async (
			id: string,
			options: { allowCurrentTurn?: boolean } = {},
		): Promise<AssistantWorkflowResult> => {
			if (!currentForm || currentForm.stage !== "review")
				return { status: "not-on-form", reason: "The grievance review is not visible.", registrationId: null };
			if (!pendingSubmission || pendingSubmission.id !== id)
				return { status: "confirmation-required", reason: "A current submission confirmation is required.", registrationId: null };
			if (!options.allowCurrentTurn && turnRef.current <= pendingSubmission.requestedTurn)
				return { status: "confirmation-required", reason: "Confirmation must come in a later citizen turn.", registrationId: null };
			if (pendingRevisionRef.current !== currentForm.revision) {
				cancelPendingSubmission();
				return { status: "stale-review", reason: "The grievance changed after confirmation was requested.", registrationId: null };
			}
			try {
				const result = await currentForm.submit();
				cancelPendingSubmission();
				return { status: "ok", reason: "The grievance was submitted.", registrationId: result.registrationId };
			} catch (error) {
				return {
					status: "unavailable",
					reason: error instanceof Error ? error.message : "The grievance could not be submitted.",
					registrationId: null,
				};
			}
		},
		[cancelPendingSubmission, currentForm, pendingSubmission],
	);

	const value = useMemo(
		() => ({
			currentForm,
			registerForm,
			applyFields,
			undoLastFill,
			canUndo: Boolean(undoValues),
			beginUserTurn,
			reviewVisibleForm,
			editVisibleForm,
			requestSubmissionConfirmation,
			submitConfirmedGrievance,
			pendingSubmission,
			cancelPendingSubmission,
		}),
		[
			applyFields,
			beginUserTurn,
			cancelPendingSubmission,
			currentForm,
			editVisibleForm,
			pendingSubmission,
			registerForm,
			requestSubmissionConfirmation,
			reviewVisibleForm,
			submitConfirmedGrievance,
			undoLastFill,
			undoValues,
		],
	);
	return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistantContext() {
	const value = useContext(AssistantContext);
	if (!value) throw new Error("useAssistantContext must be used inside AssistantProvider.");
	return value;
}
