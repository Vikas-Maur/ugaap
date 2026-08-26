import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { AuthorityChunk, CatalogueCategory, CatalogueForm } from "../../src/features/catalogue/schema.ts";
import * as dbSchema from "../../src/db/schema.ts";
import {
	ACCOUNTABILITY_METRIC_VERSION,
	calculateAccountabilityMetrics,
} from "../../src/features/accountability/metrics.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOGUE_DIR = join(ROOT, "public", "catalogue", "authorities");
const SEED_NAMESPACE = "ugaap:p0.3:synthetic-seed:v1";
const BASE_TIME = new Date("2026-08-23T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const INSERT_CHUNK_SIZE = 300;
// Better Auth scrypt hash for the intentionally public DEMO_MODE password "admin".
const DEMO_PASSWORD_HASH = "3dab4e02313f06c356bd8bc16bfdd4f1:68b298325ea07802fe052c0c6e662257fdf4fc46f3ad5121b7090f1ea95eefd3de8fa241e09e73cd14c9988d118f4d7071c31b551de57d74e04d2a33743c6a09";

type OrganizationType = "union_ministry" | "central_department" | "state" | "state_department" | "subordinate_office";
type Status = "draft" | "submitted" | "acknowledged" | "routed" | "in_review" | "needs_information" | "action_taken" | "resolved" | "appealed" | "appeal_resolved" | "withdrawn";
type PublicationConsent = "not_set" | "opted_in" | "opted_out";
type ClosureReason = "citizen_confirmed" | "department_action_unconfirmed" | "citizen_did_not_provide_information" | "withdrawn_by_citizen" | "appeal_decided" | "duplicate_merged" | "not_admissible";
type EventType = "created" | "submitted" | "status_changed" | "message" | "clarification_requested" | "clarification_replied" | "feedback_received" | "appeal_filed" | "appeal_resolved" | "publication_changed";
type ActorType = "citizen" | "officer" | "system" | "agent";
type AppealStatus = "filed" | "under_review" | "resolved" | "rejected";
type AppealDecisionOutcome = "original_decision_upheld" | "original_decision_modified" | "original_decision_overturned";
type ResolutionAssessment = "resolved" | "partially_resolved" | "not_resolved";

type OrganizationSeed = {
	id: string;
	parentOrganizationId: string | null;
	slug: string;
	name: string;
	type: OrganizationType;
	jurisdiction: string;
	source: string;
	active: true;
	createdAt: Date;
	updatedAt: Date;
};

type CategorySeed = {
	id: string;
	organizationId: string;
	parentCategoryId: string | null;
	slug: string;
	name: string;
	ancestry: string[];
	depth: number;
	active: true;
	createdAt: Date;
	updatedAt: Date;
};

type FormSeed = {
	id: string;
	formKey: string;
	organizationId: string;
	categoryNodeId: string;
	version: number;
	formSchema: Record<string, unknown>;
	sourcePath: string;
	checksum: string;
	active: boolean;
	createdAt: Date;
	updatedAt: Date;
};

type CaseSeed = {
	id: string;
	registrationId: string;
	userId: string;
	draftId: string | null;
	organizationId: string;
	categoryNodeId: string;
	formDefinitionId: string;
	status: Status;
	language: "en";
	answers: Record<string, unknown>;
	remarks: string;
	reviewHash: string;
	idempotencyKey: string;
	publicConsent: PublicationConsent;
	closureReason: ClosureReason | null;
	closedAt: Date | null;
	closureNote: string | null;
	citizenResponseDueAt: Date | null;
	appealEligibleUntil: Date | null;
	submittedAt: Date;
	createdAt: Date;
	updatedAt: Date;
};

type SeedData = {
	organizations: OrganizationSeed[];
	categories: CategorySeed[];
	forms: FormSeed[];
	user: {
		id: string;
		name: string;
		email: string;
		emailVerified: true;
		image: null;
		createdAt: Date;
		updatedAt: Date;
	};
	role: { id: string; slug: "citizen"; name: string; active: true; createdAt: Date };
	permissions: Array<{ id: string; key: string; description: string; active: true; createdAt: Date }>;
	drafts: Array<{
		id: string;
		userId: string;
		formDefinitionId: string;
		language: "en";
		answers: Record<string, unknown>;
		remarks: string;
		attachmentMetadata: Array<Record<string, unknown>>;
		aiConfidence: string;
		reviewHash: string;
		publicConsent: "not_set";
		createdAt: Date;
		updatedAt: Date;
	}>;
	grievances: CaseSeed[];
	events: Array<{
		id: string;
		grievanceId: string;
		eventType: EventType;
		actorType: ActorType;
		actorUserId: string | null;
		fromStatus: Status | null;
		toStatus: Status | null;
		message: string;
		metadata: Record<string, unknown>;
		createdAt: Date;
	}>;
	feedback: Array<{ id: string; grievanceId: string; userId: string; score: number; resolutionAssessment: ResolutionAssessment; comment: string; createdAt: Date; updatedAt: Date }>;
	appeals: Array<{ id: string; grievanceId: string; userId: string; reason: string; status: AppealStatus; decisionOutcome: AppealDecisionOutcome | null; resolvedAt: Date | null; resolution: string | null; createdAt: Date; updatedAt: Date }>;
	publicGrievances: Array<{
		id: string;
		grievanceId: string;
		publicId: string;
		summary: string;
		categoryPath: string[];
		organizationId: string;
		status: Status;
		broadLocation: string;
		synthetic: true;
		publishedAt: Date;
		withdrawnAt: null;
		createdAt: Date;
		updatedAt: Date;
	}>;
	publicEvents: Array<{
		id: string;
		publicGrievanceId: string;
		sourceEventId: string;
		status: Status;
		label: string;
		occurredAt: Date;
		createdAt: Date;
	}>;
	snapshots: Array<{
		id: string;
		organizationId: string;
		categoryNodeId: string | null;
		metricKey: string;
		metricVersion: string;
		windowDays: number;
		windowStart: Date;
		windowEnd: Date;
		value: string;
		sampleSize: number;
		numerator: number | null;
		denominator: number | null;
		eligible: boolean;
		supportingMetrics: Record<string, number | null>;
		sourceKind: "synthetic";
		createdAt: Date;
	}>;
};

function deterministicUuid(key: string): string {
	const hex = createHash("sha256").update(`${SEED_NAMESPACE}:${key}`).digest("hex").slice(0, 32).split("");
	hex[12] = "5";
	hex[16] = ((Number.parseInt(hex[16] ?? "8", 16) & 0x3) | 0x8).toString(16);
	return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function digest(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function at(daysAgo: number, hour = 12): Date {
	const date = new Date(BASE_TIME.getTime() - daysAgo * DAY);
	date.setUTCHours(hour, 0, 0, 0);
	return date;
}

function cloneDate(date: Date): Date {
	return new Date(date.getTime());
}

function chunkRows<T>(items: T[], size = INSERT_CHUNK_SIZE): T[][] {
	const result: T[][] = [];
	for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
	return result;
}

function isAuthorityChunk(value: unknown): value is AuthorityChunk {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<AuthorityChunk>;
	return Boolean(candidate.authority && Array.isArray(candidate.categories) && Array.isArray(candidate.forms));
}

function loadCatalogue(): AuthorityChunk[] {
	const files = readdirSync(CATALOGUE_DIR).filter((name) => name.endsWith(".json")).sort();
	if (files.length === 0) throw new Error(`No generated catalogue authorities found in ${CATALOGUE_DIR}`);
	return files.map((file) => {
		const value: unknown = JSON.parse(readFileSync(join(CATALOGUE_DIR, file), "utf8"));
		if (!isAuthorityChunk(value)) throw new Error(`Invalid generated authority chunk: ${file}`);
		return value;
	});
}

function syntheticOrganization(
	slug: string,
	name: string,
	type: OrganizationType,
	parentOrganizationId: string | null = null,
): OrganizationSeed {
	const id = deterministicUuid(`organization:${slug}`);
	return {
		id,
		parentOrganizationId,
		slug,
		name,
		type,
		jurisdiction: type === "state" || type === "state_department" ? name.replace("[SYNTHETIC] ", "") : "India",
		source: "synthetic-seed:p0.3",
		active: true,
		createdAt: cloneDate(BASE_TIME),
		updatedAt: cloneDate(BASE_TIME),
	};
}

function catalogueOrganization(chunk: AuthorityChunk): OrganizationSeed {
	const id = deterministicUuid(`organization:catalogue:${chunk.authority.slug}`);
	return {
		id,
		parentOrganizationId: null,
		slug: chunk.authority.slug,
		name: chunk.authority.name,
		type: "central_department",
		jurisdiction: "India",
		source: "synthetic-seed:catalogue",
		active: true,
		createdAt: cloneDate(BASE_TIME),
		updatedAt: cloneDate(BASE_TIME),
	};
}

function answerForField(field: CatalogueForm["fields"][number], index: number): unknown {
	if (field.kind === "number") return String(1000 + index);
	if (field.kind === "select" && field.options?.[0]) return field.options[0];
	if (field.kind === "file") return `synthetic-attachment-${index}.pdf`;
	return `Synthetic demo answer ${index + 1}`;
}

function toCategorySeed(category: CatalogueCategory, organizationId: string, ids: Map<string, string>, sourceCategories: Map<string, CatalogueCategory>): CategorySeed {
	const id = deterministicUuid(`category:${organizationId}:${category.id}`);
	ids.set(category.id, id);
	const ancestry: string[] = [];
	let current: string | null = category.id;
	while (current) {
		const currentId = ids.get(current);
		if (!currentId) break;
		ancestry.unshift(currentId);
		current = sourceCategories.get(current)?.parentId ?? null;
	}
	return {
		id,
		organizationId,
		parentCategoryId: category.parentId ? deterministicUuid(`category:${organizationId}:${category.parentId}`) : null,
		slug: category.slug,
		name: category.name,
		ancestry,
		depth: category.path.length - 1,
		active: true,
		createdAt: cloneDate(BASE_TIME),
		updatedAt: cloneDate(BASE_TIME),
	};
}

function buildSeedData(chunks: AuthorityChunk[]): SeedData {
	const organizations = chunks.map(catalogueOrganization);
	const central = syntheticOrganization("synthetic-central-accountability", "[SYNTHETIC] Central Accountability Office", "union_ministry");
	const centralServices = syntheticOrganization("synthetic-central-citizen-services", "[SYNTHETIC] Central Citizen Services Department", "central_department", central.id);
	const maharashtra = syntheticOrganization("synthetic-state-maharashtra", "[SYNTHETIC] Maharashtra State Government", "state");
	const karnataka = syntheticOrganization("synthetic-state-karnataka", "[SYNTHETIC] Karnataka State Government", "state");
	organizations.push(central, centralServices, maharashtra, karnataka);

	const categories: CategorySeed[] = [];
	const forms: FormSeed[] = [];
	const formById = new Map<string, FormSeed>();
	for (const chunk of chunks) {
		const organizationId = deterministicUuid(`organization:catalogue:${chunk.authority.slug}`);
		const categoryIds = new Map<string, string>();
		const sourceCategories = new Map(chunk.categories.map((category) => [category.id, category]));
		for (const category of [...chunk.categories].sort((a, b) => a.path.length - b.path.length || a.id.localeCompare(b.id))) {
			categories.push(toCategorySeed(category, organizationId, categoryIds, sourceCategories));
		}
		for (const form of [...chunk.forms].sort((a, b) => a.id.localeCompare(b.id))) {
			const categoryNodeId = categoryIds.get(form.categoryId);
			if (!categoryNodeId) throw new Error(`Form ${form.id} refers to missing category ${form.categoryId}`);
			const id = deterministicUuid(`form:${organizationId}:${form.id}:version:${form.version}`);
			const formSeed: FormSeed = {
				id,
				formKey: form.id,
				organizationId,
				categoryNodeId,
				version: form.version,
				formSchema: {
					id: form.id,
					title: form.title,
					heading: form.heading,
					categoryPath: form.categoryPath,
					fields: form.fields,
					active: form.active,
				},
				sourcePath: form.sourcePath,
				checksum: form.checksum,
				active: form.active,
				createdAt: cloneDate(BASE_TIME),
				updatedAt: cloneDate(BASE_TIME),
			};
			forms.push(formSeed);
			formById.set(`${form.id}:${form.version}`, formSeed);
		}
	}
	for (const syntheticAuthority of [centralServices, maharashtra, karnataka]) {
		const categoryId = deterministicUuid(
			`category:${syntheticAuthority.id}:general-services`,
		);
		const formKey = `synthetic-${syntheticAuthority.slug}-general-services`;
		const formId = deterministicUuid(
			`form:${syntheticAuthority.id}:${formKey}:version:1`,
		);
		categories.push({
			id: categoryId,
			organizationId: syntheticAuthority.id,
			parentCategoryId: null,
			slug: "general-services",
			name: "General public services",
			ancestry: [categoryId],
			depth: 0,
			active: true,
			createdAt: cloneDate(BASE_TIME),
			updatedAt: cloneDate(BASE_TIME),
		});
		const formSchema = {
			id: formKey,
			title: "General public service grievance",
			heading: "Describe the public service issue",
			categoryPath: ["General public services"],
			fields: [],
			active: true,
		};
		const form: FormSeed = {
			id: formId,
			formKey,
			organizationId: syntheticAuthority.id,
			categoryNodeId: categoryId,
			version: 1,
			formSchema,
			sourcePath: "synthetic-seed",
			checksum: digest(formSchema),
			active: true,
			createdAt: cloneDate(BASE_TIME),
			updatedAt: cloneDate(BASE_TIME),
		};
		forms.push(form);
		formById.set(`${form.formKey}:${form.version}`, form);
	}
	if (forms.length === 0) throw new Error("Generated catalogue contains no forms");

	const userId = "synthetic-demo-citizen-template";
	const user = { id: userId, name: "UGAAP Test Citizen", email: "admin@ugaap.test", emailVerified: true as const, image: null, createdAt: cloneDate(BASE_TIME), updatedAt: cloneDate(BASE_TIME) };
	const role = { id: deterministicUuid("role:citizen"), slug: "citizen" as const, name: "Citizen", active: true as const, createdAt: cloneDate(BASE_TIME) };
	const permissions = [
		["grievance:create", "Create a grievance"],
		["grievance:read:self", "Read own grievances"],
		["grievance:reply:self", "Reply to own clarification requests"],
		["appeal:create", "Create an appeal for an eligible grievance"],
		["publication:manage:self", "Manage publication consent for own grievances"],
		["analytics:read:public", "Read public accountability analytics"],
	].map(([key, description]) => ({ id: deterministicUuid(`permission:${key}`), key: key ?? "", description: description ?? "", active: true as const, createdAt: cloneDate(BASE_TIME) }));

	const orderedForms = [...forms].sort((a, b) => a.formKey.localeCompare(b.formKey));
	const currentForms = orderedForms.filter((form) => form.active);
	if (currentForms.length === 0) throw new Error("Generated catalogue contains no active forms for synthetic cases");
	const targetForms = currentForms.slice(0, 12);
	const caseDefinitions: Array<{ key: string; status: Status; formIndex: number; consent: PublicationConsent }> = [
		{ key: "draft", status: "draft", formIndex: 0, consent: "not_set" },
		{ key: "submitted", status: "submitted", formIndex: 1, consent: "opted_out" },
		{ key: "acknowledged", status: "acknowledged", formIndex: 2, consent: "opted_out" },
		{ key: "routed", status: "routed", formIndex: 3, consent: "opted_out" },
		{ key: "in-review", status: "in_review", formIndex: 4, consent: "opted_out" },
		{ key: "needs-information", status: "needs_information", formIndex: 5, consent: "opted_out" },
		{ key: "action-taken", status: "action_taken", formIndex: 6, consent: "opted_in" },
		{ key: "resolved-poor", status: "resolved", formIndex: 7, consent: "opted_in" },
		{ key: "resolved-positive", status: "resolved", formIndex: 8, consent: "opted_in" },
		{ key: "appealed", status: "appealed", formIndex: 9, consent: "opted_in" },
		{ key: "appeal-resolved", status: "appeal_resolved", formIndex: 10, consent: "opted_in" },
		{ key: "withdrawn", status: "withdrawn", formIndex: 11, consent: "opted_out" },
	];
	const grievances: CaseSeed[] = [];
	const drafts: SeedData["drafts"] = [];
	for (const [index, definition] of caseDefinitions.entries()) {
		const form = targetForms[definition.formIndex % targetForms.length] ?? orderedForms[definition.formIndex % orderedForms.length];
		if (!form) throw new Error("Unable to select a form for synthetic case");
		const catalogueForm = chunks.flatMap((chunk) => chunk.forms).find((candidate) => candidate.id === form.formKey);
		if (!catalogueForm) throw new Error(`Unable to find source form ${form.formKey}`);
		const answers = Object.fromEntries(catalogueForm.fields.map((field, fieldIndex) => [field.id, answerForField(field, fieldIndex)]));
		const createdAt = at(8 + index * 4, 9 + (index % 8));
		const reviewHash = digest({ formChecksum: form.checksum, answers, remarks: `Synthetic demo grievance ${definition.key}` });
		if (definition.status === "draft") {
			const draftId = deterministicUuid(`draft:${definition.key}`);
			drafts.push({ id: draftId, userId, formDefinitionId: form.id, language: "en", answers, remarks: "Synthetic demo draft; complete the review before submitting.", attachmentMetadata: [], aiConfidence: "0.9800", reviewHash, publicConsent: "not_set", createdAt: cloneDate(createdAt), updatedAt: cloneDate(BASE_TIME) });
			continue;
		}
		const id = deterministicUuid(`grievance:${definition.key}`);
		const resolvedAt = definition.status === "appeal_resolved" ? new Date(createdAt.getTime() + 8 * DAY) : definition.status === "withdrawn" ? new Date(createdAt.getTime() + DAY) : definition.status === "resolved" ? new Date(createdAt.getTime() + 6 * DAY) : null;
		const closureReason: ClosureReason | null = definition.key === "resolved-positive" ? "citizen_confirmed" : definition.key === "resolved-poor" ? "department_action_unconfirmed" : definition.status === "appeal_resolved" ? "appeal_decided" : definition.status === "withdrawn" ? "withdrawn_by_citizen" : null;
		const citizenResponseDueAt = definition.status === "needs_information" || definition.status === "action_taken" ? new Date(BASE_TIME.getTime() + 7 * DAY) : null;
		const appealEligibleUntil = definition.status === "resolved" && resolvedAt ? new Date(resolvedAt.getTime() + 45 * DAY) : null;
		const grievance: CaseSeed = {
			id,
			registrationId: `SYN-20260823-${String(index + 1).padStart(3, "0")}`,
			userId,
			draftId: null,
			organizationId: form.organizationId,
			categoryNodeId: form.categoryNodeId,
			formDefinitionId: form.id,
			status: definition.status,
			language: "en",
			answers,
			remarks: `Synthetic demo grievance (${definition.key}); no real citizen data.`,
			reviewHash,
			idempotencyKey: `synthetic-seed:p0.3:${definition.key}`,
			publicConsent: definition.consent,
			closureReason,
			closedAt: resolvedAt,
			closureNote: closureReason ? `Synthetic closure: ${closureReason.replaceAll("_", " ")}.` : null,
			citizenResponseDueAt,
			appealEligibleUntil,
			submittedAt: cloneDate(createdAt),
			createdAt: cloneDate(createdAt),
			updatedAt: cloneDate(BASE_TIME),
		};
		grievances.push(grievance);
	}

	const lifecycle: Status[] = ["submitted", "acknowledged", "routed", "in_review", "needs_information", "action_taken", "resolved", "appealed", "appeal_resolved"];
	const events: SeedData["events"] = [];
	for (const grievance of grievances) {
		const definition = caseDefinitions.find(
			(candidate) =>
				grievance.id === deterministicUuid(`grievance:${candidate.key}`),
		);
		if (!definition) continue;
		const history = definition.status === "draft" ? ["draft" as Status] : definition.status === "withdrawn" ? ["submitted" as Status, "withdrawn" as Status] : lifecycle.slice(0, Math.max(1, lifecycle.indexOf(definition.status) + 1));
		let previous: Status | null = null;
		for (const [eventIndex, status] of history.entries()) {
			const isAppeal = status === "appealed";
			const isAppealResolved = status === "appeal_resolved";
			const isClarification = status === "needs_information";
			const eventType: EventType = eventIndex === 0 && status === "draft" ? "created" : isAppeal ? "appeal_filed" : isAppealResolved ? "appeal_resolved" : isClarification ? "clarification_requested" : eventIndex === 0 ? "submitted" : "status_changed";
			events.push({
				id: deterministicUuid(`event:${grievance.id}:${eventIndex}:${status}`),
				grievanceId: grievance.id,
				eventType,
				actorType: eventType === "appeal_filed" ? "citizen" : eventType === "created" || eventType === "submitted" ? "system" : "officer",
				actorUserId: eventType === "appeal_filed" ? userId : null,
				fromStatus: previous,
				toStatus: status,
				message: isClarification ? "Synthetic department question: please provide one more supporting detail." : `Synthetic lifecycle update: ${status}.`,
				metadata: { synthetic: true, seed: "p0.3", caseKey: definition.key },
				createdAt: new Date(grievance.createdAt.getTime() + eventIndex * DAY),
			});
			previous = status;
		}
	}

	const feedback: SeedData["feedback"] = [
		{ caseKey: "resolved-poor", score: 1, resolutionAssessment: "not_resolved" as const, comment: "Synthetic poor-resolution rating; appeal action should be available." },
		{ caseKey: "resolved-positive", score: 5, resolutionAssessment: "resolved" as const, comment: "Synthetic positive resolution rating." },
		{ caseKey: "appealed", score: 1, resolutionAssessment: "not_resolved" as const, comment: "Synthetic poor rating retained on appealed case." },
	].map((entry) => {
		const grievance = grievances.find((item) => item.id === deterministicUuid(`grievance:${entry.caseKey}`));
		if (!grievance) throw new Error(`Missing feedback grievance ${entry.caseKey}`);
		return { id: deterministicUuid(`feedback:${entry.caseKey}`), grievanceId: grievance.id, userId, score: entry.score, resolutionAssessment: entry.resolutionAssessment, comment: entry.comment, createdAt: cloneDate(BASE_TIME), updatedAt: cloneDate(BASE_TIME) };
	});
	const appealedGrievance = grievances.find((item) => item.id === deterministicUuid("grievance:appealed"));
	if (!appealedGrievance) throw new Error("Missing appealed synthetic grievance");
	const appeals: SeedData["appeals"] = [{ id: deterministicUuid("appeal:appealed"), grievanceId: appealedGrievance.id, userId, reason: "Synthetic appeal: the resolution did not address the reported issue.", status: "filed", decisionOutcome: null, resolvedAt: null, resolution: null, createdAt: cloneDate(BASE_TIME), updatedAt: cloneDate(BASE_TIME) }];

	const publicGrievances: SeedData["publicGrievances"] = ["action-taken", "resolved-poor", "appeal-resolved"].map((caseKey, index) => {
		const grievance = grievances.find((item) => item.id === deterministicUuid(`grievance:${caseKey}`));
		if (!grievance) throw new Error(`Missing public grievance ${caseKey}`);
		const selectedForm = forms.find((item) => item.id === grievance.formDefinitionId);
		const form = selectedForm ? formById.get(`${selectedForm.formKey}:${selectedForm.version}`) : undefined;
		const categoryPath = form?.formSchema.categoryPath;
		return {
			id: deterministicUuid(`public:${caseKey}`),
			grievanceId: grievance.id,
			publicId: `SYN-PUBLIC-${String(index + 1).padStart(3, "0")}`,
			summary: `Synthetic redacted example: a resident reported a service delay to a public authority. Personal contact details and identifiers are omitted.`,
			categoryPath: Array.isArray(categoryPath) && categoryPath.every((part): part is string => typeof part === "string") ? categoryPath : ["Synthetic demo"],
			organizationId: grievance.organizationId,
			status: grievance.status,
			broadLocation: index === 0 ? "Synthetic district, India" : "Synthetic region, India",
			synthetic: true as const,
			publishedAt: cloneDate(grievance.createdAt),
			withdrawnAt: null,
			createdAt: cloneDate(grievance.createdAt),
			updatedAt: cloneDate(BASE_TIME),
		};
	});

	const activeFormsByOrganization = new Map<string, FormSeed[]>();
	for (const form of forms.filter((item) => item.active)) {
		const organizationForms = activeFormsByOrganization.get(form.organizationId) ?? [];
		organizationForms.push(form);
		activeFormsByOrganization.set(form.organizationId, organizationForms);
	}
	const bulkStatuses: Status[] = [
		"resolved",
		"resolved",
		"resolved",
		"in_review",
		"acknowledged",
		"needs_information",
		"appeal_resolved",
		"appeal_resolved",
	];
	for (const [organizationIndex, organization] of organizations.entries()) {
		const organizationForms = activeFormsByOrganization.get(organization.id);
		if (!organizationForms?.length) continue;
		for (let caseIndex = 0; caseIndex < 120; caseIndex += 1) {
			const form = organizationForms[caseIndex % organizationForms.length];
			if (!form) continue;
			const daysAgo = 2 + ((caseIndex * 5 + organizationIndex * 11) % 358);
			const submittedAt = at(daysAgo, 6 + (caseIndex % 10));
			const status = bulkStatuses[(caseIndex + organizationIndex) % bulkStatuses.length] ?? "in_review";
			const responseHours = 3 + ((organizationIndex * 13 + caseIndex * 7) % 110);
			const resolutionDays = 4 + ((organizationIndex * 9 + caseIndex * 11) % 72);
			const isClosed = status === "resolved" || status === "appeal_resolved";
			const possibleClosedAt = new Date(submittedAt.getTime() + resolutionDays * DAY);
			const closedAt = isClosed && possibleClosedAt <= BASE_TIME ? possibleClosedAt : null;
			const finalStatus: Status = isClosed && !closedAt ? "in_review" : status;
			const closureReason: ClosureReason | null = closedAt
				? finalStatus === "appeal_resolved"
					? "appeal_decided"
					: caseIndex % 4 === 0
						? "department_action_unconfirmed"
						: "citizen_confirmed"
				: null;
			const caseKey = `bulk:${organization.slug}:${caseIndex}`;
			const grievanceId = deterministicUuid(`grievance:${caseKey}`);
			const rating = 1 + ((caseIndex * 3 + organizationIndex * 2) % 5);
			const resolutionAssessment: ResolutionAssessment = rating <= 2 ? "not_resolved" : rating === 3 ? "partially_resolved" : "resolved";
			const categoryPathValue = form.formSchema.categoryPath;
			const categoryPath = Array.isArray(categoryPathValue) && categoryPathValue.every((part): part is string => typeof part === "string") ? categoryPathValue : ["Public services"];
			const reviewHash = digest({ formChecksum: form.checksum, caseKey });
			const grievance: CaseSeed = {
				id: grievanceId,
				registrationId: `SYN-${String(organizationIndex + 1).padStart(2, "0")}-${String(caseIndex + 1).padStart(4, "0")}`,
				userId,
				draftId: null,
				organizationId: organization.id,
				categoryNodeId: form.categoryNodeId,
				formDefinitionId: form.id,
				status: finalStatus,
				language: "en",
				answers: {},
				remarks: `Synthetic public-service grievance ${caseIndex + 1}; no real citizen data.`,
				reviewHash,
				idempotencyKey: `synthetic-seed:accountability:${organization.slug}:${caseIndex}`,
				publicConsent: caseIndex % 3 === 0 ? "opted_in" : "opted_out",
				closureReason,
				closedAt,
				closureNote: closureReason ? "Synthetic department closure for accountability calculations." : null,
				citizenResponseDueAt: finalStatus === "needs_information" ? new Date(BASE_TIME.getTime() + 7 * DAY) : null,
				appealEligibleUntil: finalStatus === "resolved" && closedAt ? new Date(closedAt.getTime() + 45 * DAY) : null,
				submittedAt,
				createdAt: submittedAt,
				updatedAt: cloneDate(BASE_TIME),
			};
			grievances.push(grievance);
			events.push({
				id: deterministicUuid(`event:${caseKey}:submitted`),
				grievanceId,
				eventType: "submitted",
				actorType: "system",
				actorUserId: null,
				fromStatus: null,
				toStatus: "submitted",
				message: "Grievance submitted.",
				metadata: { synthetic: true },
				createdAt: submittedAt,
			});
			const firstResponseAt = new Date(submittedAt.getTime() + responseHours * 60 * 60 * 1_000);
			if (firstResponseAt <= BASE_TIME) {
				events.push({
					id: deterministicUuid(`event:${caseKey}:response`),
					grievanceId,
					eventType: "status_changed",
					actorType: "officer",
					actorUserId: null,
					fromStatus: "submitted",
					toStatus: "acknowledged",
					message: "The authority acknowledged the grievance.",
					metadata: { synthetic: true },
					createdAt: firstResponseAt,
				});
			}
			if (closedAt) {
				events.push({
					id: deterministicUuid(`event:${caseKey}:closed`),
					grievanceId,
					eventType: finalStatus === "appeal_resolved" ? "appeal_resolved" : "status_changed",
					actorType: "officer",
					actorUserId: null,
					fromStatus: "in_review",
					toStatus: finalStatus,
					message: finalStatus === "appeal_resolved" ? "The appeal was decided." : "The grievance was closed after department action.",
					metadata: { synthetic: true },
					createdAt: closedAt,
				});
				const feedbackAt = new Date(Math.min(BASE_TIME.getTime(), closedAt.getTime() + DAY));
				if (caseIndex % 5 !== 4) {
					feedback.push({
						id: deterministicUuid(`feedback:${caseKey}`),
						grievanceId,
						userId,
						score: rating,
						resolutionAssessment,
						comment: `Synthetic ${resolutionAssessment.replaceAll("_", " ")} feedback.`,
						createdAt: feedbackAt,
						updatedAt: feedbackAt,
					});
				}
			}
			if (finalStatus === "appeal_resolved" && closedAt) {
				const outcomes: AppealDecisionOutcome[] = ["original_decision_upheld", "original_decision_modified", "original_decision_overturned"];
				const decisionOutcome = outcomes[(caseIndex + organizationIndex) % outcomes.length] ?? "original_decision_upheld";
				appeals.push({
					id: deterministicUuid(`appeal:${caseKey}`),
					grievanceId,
					userId,
					reason: "The citizen asked for the original decision to be reviewed.",
					status: "resolved",
					decisionOutcome,
					resolvedAt: closedAt,
					resolution: "Synthetic appeal decision used for accountability calculations.",
					createdAt: new Date(Math.max(submittedAt.getTime(), closedAt.getTime() - 5 * DAY)),
					updatedAt: closedAt,
				});
			}
			if (grievance.publicConsent === "opted_in") {
				const topics = ["service request delay", "document processing issue", "public facility maintenance", "benefit application follow-up", "local office response"];
				publicGrievances.push({
					id: deterministicUuid(`public:${caseKey}`),
					grievanceId,
					publicId: `SYN-PUBLIC-${digest(caseKey).slice(0, 12).toUpperCase()}`,
					summary: `A resident reported a ${topics[(caseIndex + organizationIndex) % topics.length]} and requested an update from the responsible authority. Identifying details have been removed.`,
					categoryPath,
					organizationId: organization.id,
					status: finalStatus,
					broadLocation: organization.jurisdiction === "India" ? "India" : `${organization.jurisdiction}, India`,
					synthetic: true,
					publishedAt: submittedAt,
					withdrawnAt: null,
					createdAt: submittedAt,
					updatedAt: cloneDate(BASE_TIME),
				});
			}
		}
	}
	const publicStatusLabels: Record<Status, string> = {
		draft: "Grievance prepared",
		submitted: "Grievance submitted",
		acknowledged: "Grievance acknowledged",
		routed: "Sent to the responsible organization",
		in_review: "Under review",
		needs_information: "More information requested",
		action_taken: "Organization reports action taken",
		resolved: "Grievance resolved",
		appealed: "Resolution appealed",
		appeal_resolved: "Appeal decided",
		withdrawn: "Official grievance withdrawn",
	};
	const projectableEventTypes = new Set<EventType>([
		"submitted",
		"status_changed",
		"appeal_filed",
		"appeal_resolved",
	]);
	const publicEvents = publicGrievances.flatMap((publicCopy) =>
		events
			.filter(
				(event) =>
					event.grievanceId === publicCopy.grievanceId &&
					event.toStatus !== null &&
					projectableEventTypes.has(event.eventType),
			)
			.map((event) => ({
				id: deterministicUuid(`public-event:${publicCopy.id}:${event.id}`),
				publicGrievanceId: publicCopy.id,
				sourceEventId: event.id,
				status: event.toStatus ?? "submitted",
				label: publicStatusLabels[event.toStatus ?? "submitted"],
				occurredAt: cloneDate(event.createdAt),
				createdAt: cloneDate(event.createdAt),
			})),
	);

	const snapshots: SeedData["snapshots"] = [];
	const materializeSnapshot = (organization: OrganizationSeed, categoryNodeId: string | null, windowDays: number, windowEnd: Date) => {
		const windowStart = new Date(windowEnd.getTime() - windowDays * DAY);
		const scopedCases = grievances.filter((item) => item.organizationId === organization.id && (categoryNodeId === null || item.categoryNodeId === categoryNodeId));
		const caseIds = new Set(scopedCases.map((item) => item.id));
		const metrics = calculateAccountabilityMetrics({
			cases: scopedCases,
			events: events.filter((item) => caseIds.has(item.grievanceId)),
			feedback: feedback.filter((item) => caseIds.has(item.grievanceId)),
			appeals: appeals.filter((item) => caseIds.has(item.grievanceId)),
			windowStart,
			windowEnd,
		});
		for (const metric of metrics) {
			if (categoryNodeId !== null && metric.sampleSize === 0) continue;
			const scopeKey = categoryNodeId ?? "authority";
			snapshots.push({
				id: deterministicUuid(`accountability:${organization.slug}:${scopeKey}:${metric.metricKey}:${windowDays}:${windowEnd.toISOString()}`),
				organizationId: organization.id,
				categoryNodeId,
				metricKey: metric.metricKey,
				metricVersion: ACCOUNTABILITY_METRIC_VERSION,
				windowDays,
				windowStart,
				windowEnd: cloneDate(windowEnd),
				value: metric.value.toFixed(4),
				sampleSize: metric.sampleSize,
				numerator: metric.numerator,
				denominator: metric.denominator,
				eligible: metric.eligible,
				supportingMetrics: metric.supportingMetrics,
				sourceKind: "synthetic",
				createdAt: cloneDate(BASE_TIME),
			});
		}
	};
	for (const organization of organizations) {
		for (const windowDays of [30, 90, 365]) {
			materializeSnapshot(organization, null, windowDays, cloneDate(BASE_TIME));
			materializeSnapshot(organization, null, windowDays, new Date(BASE_TIME.getTime() - windowDays * DAY));
		}
		for (const period of [1, 2, 4, 5, 6, 7]) materializeSnapshot(organization, null, 90, new Date(BASE_TIME.getTime() - period * 30 * DAY));
		for (const category of categories.filter((item) => item.organizationId === organization.id)) {
			for (const windowDays of [30, 90, 365]) materializeSnapshot(organization, category.id, windowDays, cloneDate(BASE_TIME));
		}
	}

	return { organizations, categories, forms, user, role, permissions, drafts, grievances, events, feedback, appeals, publicGrievances, publicEvents, snapshots };
}

function uniqueCount(values: string[]): number {
	return new Set(values).size;
}

function validateSeedData(data: SeedData, chunks: AuthorityChunk[]): void {
	const statusCounts = new Map<Status, number>();
	for (const grievance of data.grievances) statusCounts.set(grievance.status, (statusCounts.get(grievance.status) ?? 0) + 1);
	const statuses: Status[] = ["draft", "submitted", "acknowledged", "routed", "in_review", "needs_information", "action_taken", "resolved", "appealed", "appeal_resolved", "withdrawn"];
	for (const status of statuses) {
		if (status === "draft") {
			if (data.drafts.length === 0)
				throw new Error("Seed coverage missing lifecycle status: draft");
			continue;
		}
		if (!statusCounts.get(status))
			throw new Error(`Seed coverage missing lifecycle status: ${status}`);
	}
	const generatedForms = chunks.flatMap((chunk) => chunk.forms);
	const catalogueFormKeys = new Set(generatedForms.map((form) => `${form.id}:${form.version}`));
	const catalogueSeedForms = data.forms.filter((form) => form.sourcePath !== "synthetic-seed");
	if (catalogueSeedForms.length !== catalogueFormKeys.size || catalogueSeedForms.some((form) => !catalogueFormKeys.has(`${form.formKey}:${form.version}`))) throw new Error("Seed coverage does not include every generated catalogue form version");
	for (const generatedForm of generatedForms) {
		const storedForm = data.forms.find((form) => form.formKey === generatedForm.id && form.version === generatedForm.version);
		if (!storedForm || storedForm.checksum !== generatedForm.checksum || storedForm.active !== generatedForm.active) throw new Error(`Seed form metadata mismatch for ${generatedForm.id} version ${generatedForm.version}`);
		if (storedForm.id !== deterministicUuid(`form:${storedForm.organizationId}:${storedForm.formKey}:version:${storedForm.version}`)) throw new Error(`Seed form ID is not version-stable for ${generatedForm.id} version ${generatedForm.version}`);
	}
	for (const formKey of new Set(generatedForms.map((form) => form.id))) {
		if (generatedForms.filter((form) => form.id === formKey && form.active).length > 1) throw new Error(`Multiple active generated versions for form ${formKey}`);
	}
	if (data.categories.length !== chunks.reduce((sum, chunk) => sum + chunk.categories.length, 0) + 3) throw new Error("Seed coverage does not include every generated and synthetic category");
	if (!data.organizations.some((organization) => organization.type === "state" && organization.name.startsWith("[SYNTHETIC]"))) throw new Error("Missing synthetic state organization coverage");
	if (!data.organizations.some((organization) => organization.type === "union_ministry" && organization.name.startsWith("[SYNTHETIC]"))) throw new Error("Missing synthetic central organization coverage");
	const poor = data.grievances.find((grievance) => grievance.id === deterministicUuid("grievance:resolved-poor"));
	if (!poor || poor.status !== "resolved" || poor.closureReason !== "department_action_unconfirmed" || !poor.closedAt || !poor.appealEligibleUntil || poor.appealEligibleUntil <= BASE_TIME || !data.feedback.some((item) => item.grievanceId === poor.id && item.score <= 2)) throw new Error("Missing poor-rated, appeal-eligible resolved case");
	const clarification = data.grievances.find((grievance) => grievance.status === "needs_information");
	if (!clarification || !clarification.citizenResponseDueAt || !data.events.some((event) => event.grievanceId === clarification.id && event.eventType === "clarification_requested")) throw new Error("Missing citizen clarification case");
	for (const grievance of data.grievances) {
		if (Boolean(grievance.closureReason) !== Boolean(grievance.closedAt)) throw new Error(`Closure reason/timestamp mismatch for ${grievance.registrationId}`);
		if (grievance.appealEligibleUntil && grievance.closedAt && grievance.appealEligibleUntil < grievance.closedAt) throw new Error(`Appeal deadline precedes closure for ${grievance.registrationId}`);
	}
	if (data.publicGrievances.length < 100 || data.publicGrievances.some((item) => !item.synthetic || /@|\\+91|account|phone/i.test(item.summary))) throw new Error("Missing redacted public synthetic examples");
	if (data.publicEvents.length < data.publicGrievances.length) throw new Error("Each public synthetic example needs a safe status timeline");
	if (uniqueCount(data.organizations.map((item) => item.id)) !== data.organizations.length || uniqueCount(data.forms.map((item) => item.id)) !== data.forms.length || uniqueCount(data.grievances.map((item) => item.id)) !== data.grievances.length) throw new Error("Seed contains duplicate deterministic IDs");
	if (uniqueCount(data.publicGrievances.map((item) => item.publicId)) !== data.publicGrievances.length) throw new Error("Seed contains duplicate public IDs");
	if (data.feedback.some((item) => !item.resolutionAssessment)) throw new Error("Every feedback response must include a resolution assessment");
	if (data.appeals.some((item) => (item.status === "resolved") !== Boolean(item.decisionOutcome && item.resolvedAt))) throw new Error("Resolved appeal decisions need an outcome and resolution timestamp");
	for (const organization of data.organizations) {
		const authoritySnapshots = data.snapshots.filter((item) => item.organizationId === organization.id && item.categoryNodeId === null);
		if (!authoritySnapshots.some((item) => item.windowDays === 30) || !authoritySnapshots.some((item) => item.windowDays === 90) || !authoritySnapshots.some((item) => item.windowDays === 365)) throw new Error(`Missing accountability windows for ${organization.slug}`);
	}
}

function report(data: SeedData, chunks: AuthorityChunk[], mode: "dry-run" | "apply"): void {
	console.log(`Synthetic seed ${mode} validated (fixed seed ${SEED_NAMESPACE}).`);
	console.log(`Catalogue: ${chunks.length} authorities, ${data.categories.length} categories, ${data.forms.length} forms.`);
	const inactiveForms = data.forms.filter((form) => !form.active).length;
	const nonV1Forms = data.forms.filter((form) => form.version !== 1).length;
	if (inactiveForms > 0 || nonV1Forms > 0) console.log(`Catalogue version coverage: ${nonV1Forms} non-v1 forms, ${inactiveForms} inactive forms.`);
	console.log(`Rows: ${data.organizations.length} organizations, 1 demo citizen, ${data.grievances.length} grievances, ${data.events.length} events, ${data.feedback.length} feedback, ${data.appeals.length} appeals, ${data.publicGrievances.length} public cases, ${data.publicEvents.length} public events, ${data.snapshots.length} accountability metric snapshots.`);
	console.log(`Lifecycle coverage: ${[...new Set(["draft" as Status, ...data.grievances.map((grievance) => grievance.status)])].sort().join(", ")}.`);
}

async function applySeed(data: SeedData): Promise<void> {
	const { config } = await import("dotenv");
	config({ path: join(ROOT, ".env.local"), quiet: true });
	config({ path: join(ROOT, ".env"), quiet: true });
	if (!process.env.DATABASE_URL) throw new Error("--apply requires DATABASE_URL; dry-run does not require a database");
	const { db } = await import("../../src/db/index.ts");
	await db.transaction(async (tx) => {
		await tx.insert(dbSchema.role).values(data.role).onConflictDoUpdate({ target: dbSchema.role.id, set: { slug: data.role.slug, name: data.role.name, active: data.role.active } });
		for (const rows of chunkRows(data.permissions)) await tx.insert(dbSchema.permission).values(rows).onConflictDoUpdate({ target: dbSchema.permission.id, set: { key: sql`excluded.key`, description: sql`excluded.description`, active: sql`excluded.active` } });
		await tx.insert(dbSchema.user).values(data.user).onConflictDoUpdate({ target: dbSchema.user.id, set: { name: data.user.name, email: data.user.email, emailVerified: data.user.emailVerified, image: data.user.image, updatedAt: data.user.updatedAt } });
		await tx.insert(dbSchema.account).values({ id: "synthetic-demo-citizen-credential", issuer: "local:credential", accountId: data.user.id, providerId: "credential", userId: data.user.id, password: DEMO_PASSWORD_HASH, createdAt: cloneDate(BASE_TIME), updatedAt: cloneDate(BASE_TIME) }).onConflictDoUpdate({ target: [dbSchema.account.issuer, dbSchema.account.accountId], set: { providerId: "credential", userId: data.user.id, password: DEMO_PASSWORD_HASH, updatedAt: cloneDate(BASE_TIME) } });
		await tx.insert(dbSchema.userRole).values({ userId: data.user.id, roleId: data.role.id, createdAt: cloneDate(BASE_TIME) }).onConflictDoNothing();
		await tx.insert(dbSchema.rolePermission).values(data.permissions.map((permission) => ({ roleId: data.role.id, permissionId: permission.id, createdAt: cloneDate(BASE_TIME) }))).onConflictDoNothing();
		for (const rows of chunkRows(data.organizations)) await tx.insert(dbSchema.organization).values(rows).onConflictDoUpdate({ target: dbSchema.organization.id, set: { parentOrganizationId: sql`excluded.parent_organization_id`, slug: sql`excluded.slug`, name: sql`excluded.name`, type: sql`excluded.type`, jurisdiction: sql`excluded.jurisdiction`, source: sql`excluded.source`, active: sql`excluded.active`, updatedAt: sql`excluded.updated_at` } });
		for (const rows of chunkRows(data.categories)) await tx.insert(dbSchema.categoryNode).values(rows).onConflictDoUpdate({ target: dbSchema.categoryNode.id, set: { organizationId: sql`excluded.organization_id`, parentCategoryId: sql`excluded.parent_category_id`, slug: sql`excluded.slug`, name: sql`excluded.name`, ancestry: sql`excluded.ancestry`, depth: sql`excluded.depth`, active: sql`excluded.active`, updatedAt: sql`excluded.updated_at` } });
		const formKeys = data.forms.map((form) => form.formKey);
		const formChecksums = data.forms.map((form) => form.checksum);
		const existingForms = await tx.select({ id: dbSchema.formDefinition.id, formKey: dbSchema.formDefinition.formKey, version: dbSchema.formDefinition.version, checksum: dbSchema.formDefinition.checksum, active: dbSchema.formDefinition.active }).from(dbSchema.formDefinition).where(or(inArray(dbSchema.formDefinition.formKey, formKeys), inArray(dbSchema.formDefinition.checksum, formChecksums)));
		for (const form of data.forms) {
			const existing = existingForms.find((candidate) => candidate.formKey === form.formKey && candidate.version === form.version);
			if (existing && (existing.id !== form.id || existing.checksum !== form.checksum)) throw new Error(`Catalogue form checksum/version conflict for ${form.formKey} version ${form.version}; existing history was not modified`);
			const checksumOwner = existingForms.find((candidate) => candidate.checksum === form.checksum && (candidate.formKey !== form.formKey || candidate.version !== form.version));
			if (checksumOwner) throw new Error(`Catalogue checksum conflict for ${form.formKey} version ${form.version}; checksum is already owned by ${checksumOwner.formKey} version ${checksumOwner.version}`);
		}
		for (const rows of chunkRows(data.forms)) await tx.insert(dbSchema.formDefinition).values(rows.map((form) => ({ id: form.id, formKey: form.formKey, organizationId: form.organizationId, categoryNodeId: form.categoryNodeId, version: form.version, schema: form.formSchema, sourcePath: form.sourcePath, checksum: form.checksum, active: form.active, createdAt: form.createdAt, updatedAt: form.updatedAt }))).onConflictDoNothing({ target: [dbSchema.formDefinition.formKey, dbSchema.formDefinition.version] });
		const existingById = new Map(existingForms.map((form) => [form.id, form]));
		const activateIds = data.forms.filter((form) => form.active && existingById.get(form.id)?.active === false).map((form) => form.id);
		const deactivateIds = data.forms.filter((form) => !form.active && existingById.get(form.id)?.active === true).map((form) => form.id);
		const activeVersionByKey = new Map(data.forms.filter((form) => form.active).map((form) => [form.formKey, form.version]));
		for (const existing of existingForms) if (existing.active && activeVersionByKey.has(existing.formKey) && existing.version !== activeVersionByKey.get(existing.formKey)) deactivateIds.push(existing.id);
		const uniqueActivateIds = [...new Set(activateIds)];
		const uniqueDeactivateIds = [...new Set(deactivateIds)].filter((id) => !uniqueActivateIds.includes(id));
		if (uniqueDeactivateIds.length > 0) await tx.update(dbSchema.formDefinition).set({ active: false, updatedAt: cloneDate(BASE_TIME) }).where(and(inArray(dbSchema.formDefinition.id, uniqueDeactivateIds), eq(dbSchema.formDefinition.active, true)));
		if (uniqueActivateIds.length > 0) await tx.update(dbSchema.formDefinition).set({ active: true, updatedAt: cloneDate(BASE_TIME) }).where(and(inArray(dbSchema.formDefinition.id, uniqueActivateIds), eq(dbSchema.formDefinition.active, false)));
		for (const rows of chunkRows(data.drafts)) await tx.insert(dbSchema.grievanceDraft).values(rows).onConflictDoUpdate({ target: dbSchema.grievanceDraft.id, set: { userId: sql`excluded.user_id`, formDefinitionId: sql`excluded.form_definition_id`, language: sql`excluded.language`, answers: sql`excluded.answers`, remarks: sql`excluded.remarks`, attachmentMetadata: sql`excluded.attachment_metadata`, aiConfidence: sql`excluded.ai_confidence`, reviewHash: sql`excluded.review_hash`, publicConsent: sql`excluded.public_consent`, updatedAt: sql`excluded.updated_at` } });
		await tx.delete(dbSchema.grievance).where(and(eq(dbSchema.grievance.id, deterministicUuid("grievance:draft")), eq(dbSchema.grievance.userId, data.user.id)));
		for (const rows of chunkRows(data.grievances)) await tx.insert(dbSchema.grievance).values(rows).onConflictDoUpdate({ target: dbSchema.grievance.id, set: { registrationId: sql`excluded.registration_id`, userId: sql`excluded.user_id`, draftId: sql`excluded.draft_id`, organizationId: sql`excluded.organization_id`, categoryNodeId: sql`excluded.category_node_id`, formDefinitionId: sql`excluded.form_definition_id`, status: sql`excluded.status`, language: sql`excluded.language`, answers: sql`excluded.answers`, remarks: sql`excluded.remarks`, reviewHash: sql`excluded.review_hash`, idempotencyKey: sql`excluded.idempotency_key`, publicConsent: sql`excluded.public_consent`, closureReason: sql`excluded.closure_reason`, closedAt: sql`excluded.closed_at`, closureNote: sql`excluded.closure_note`, citizenResponseDueAt: sql`excluded.citizen_response_due_at`, appealEligibleUntil: sql`excluded.appeal_eligible_until`, submittedAt: sql`excluded.submitted_at`, updatedAt: sql`excluded.updated_at` } });
		for (const rows of chunkRows(data.events)) await tx.insert(dbSchema.grievanceEvent).values(rows).onConflictDoNothing();
		for (const rows of chunkRows(data.feedback)) await tx.insert(dbSchema.feedback).values(rows).onConflictDoUpdate({ target: dbSchema.feedback.id, set: { grievanceId: sql`excluded.grievance_id`, userId: sql`excluded.user_id`, score: sql`excluded.score`, resolutionAssessment: sql`excluded.resolution_assessment`, comment: sql`excluded.comment`, updatedAt: sql`excluded.updated_at` } });
		for (const rows of chunkRows(data.appeals)) await tx.insert(dbSchema.appeal).values(rows).onConflictDoUpdate({ target: dbSchema.appeal.id, set: { grievanceId: sql`excluded.grievance_id`, userId: sql`excluded.user_id`, reason: sql`excluded.reason`, status: sql`excluded.status`, decisionOutcome: sql`excluded.decision_outcome`, resolvedAt: sql`excluded.resolved_at`, resolution: sql`excluded.resolution`, updatedAt: sql`excluded.updated_at` } });
		for (const rows of chunkRows(data.publicGrievances)) await tx.insert(dbSchema.publicGrievance).values(rows).onConflictDoUpdate({ target: dbSchema.publicGrievance.id, set: { grievanceId: sql`excluded.grievance_id`, publicId: sql`excluded.public_id`, summary: sql`excluded.summary`, categoryPath: sql`excluded.category_path`, organizationId: sql`excluded.organization_id`, status: sql`excluded.status`, broadLocation: sql`excluded.broad_location`, synthetic: sql`excluded.synthetic`, publishedAt: sql`excluded.published_at`, withdrawnAt: sql`excluded.withdrawn_at`, updatedAt: sql`excluded.updated_at` } });
		for (const rows of chunkRows(data.publicEvents)) await tx.insert(dbSchema.publicGrievanceEvent).values(rows).onConflictDoUpdate({ target: dbSchema.publicGrievanceEvent.id, set: { publicGrievanceId: sql`excluded.public_grievance_id`, sourceEventId: sql`excluded.source_event_id`, status: sql`excluded.status`, label: sql`excluded.label`, occurredAt: sql`excluded.occurred_at` } });
		await tx.delete(dbSchema.accountabilityMetricSnapshot).where(eq(dbSchema.accountabilityMetricSnapshot.sourceKind, "synthetic"));
		for (const rows of chunkRows(data.snapshots)) await tx.insert(dbSchema.accountabilityMetricSnapshot).values(rows).onConflictDoUpdate({ target: dbSchema.accountabilityMetricSnapshot.id, set: { organizationId: sql`excluded.organization_id`, categoryNodeId: sql`excluded.category_node_id`, metricKey: sql`excluded.metric_key`, metricVersion: sql`excluded.metric_version`, windowDays: sql`excluded.window_days`, windowStart: sql`excluded.window_start`, windowEnd: sql`excluded.window_end`, value: sql`excluded.value`, sampleSize: sql`excluded.sample_size`, numerator: sql`excluded.numerator`, denominator: sql`excluded.denominator`, eligible: sql`excluded.eligible`, supportingMetrics: sql`excluded.supporting_metrics`, sourceKind: sql`excluded.source_kind`, createdAt: sql`excluded.created_at` } });
	});
}

const args = new Set(process.argv.slice(2));
if (args.has("--apply") && args.has("--dry-run")) throw new Error("Choose one of --dry-run or --apply");
if (![...args].every((arg) => arg === "--apply" || arg === "--dry-run" || arg === "--validate")) throw new Error("Usage: tsx scripts/seed/index.ts [--dry-run|--validate|--apply]");
const mode = args.has("--apply") ? "apply" : "dry-run";
const chunks = loadCatalogue();
const seedData = buildSeedData(chunks);
validateSeedData(seedData, chunks);
if (mode === "apply") await applySeed(seedData);
report(seedData, chunks, mode);
