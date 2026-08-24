import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, CircleCheck, Send } from "lucide-react";
import { type FormEvent, useState } from "react";

import {
	advanceDemoGrievance,
	getGrievance,
	replyToClarification,
	submitAppeal,
	submitFeedback,
} from "#/features/grievances/functions";
import { useI18n } from "#/features/i18n/i18n";

import { StatusLabel } from "./index";

export const Route = createFileRoute(
	"/_authenticated/grievances/$registrationId",
)({
	loader: ({ params }) =>
		getGrievance({ data: { registrationId: params.registrationId } }),
	component: GrievanceDetailScreen,
});

function GrievanceDetailScreen() {
	const { text } = useI18n();
	const grievance = Route.useLoaderData();
	const router = useRouter();
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [clarification, setClarification] = useState("");
	const [score, setScore] = useState<number | null>(null);
	const [comment, setComment] = useState("");
	const [appealReason, setAppealReason] = useState("");
	const lastClarificationRequest = lastEventIndex(
		grievance.events,
		"clarification_requested",
	);
	const lastClarificationReply = lastEventIndex(
		grievance.events,
		"clarification_replied",
	);
	const hasClarificationReply =
		lastClarificationRequest >= 0 &&
		lastClarificationReply > lastClarificationRequest;
	const appealDeadline = grievance.closure.appealEligibleUntil
		? new Date(grievance.closure.appealEligibleUntil)
		: null;
	const appealIsOpen =
		grievance.status === "resolved" &&
		appealDeadline !== null &&
		!Number.isNaN(appealDeadline.getTime()) &&
		appealDeadline.getTime() > Date.now();
	const canAdvanceDemo =
		grievance.demoMode &&
		[
			"submitted",
			"acknowledged",
			"routed",
			"in_review",
			"needs_information",
			"action_taken",
		].includes(grievance.status) &&
		(grievance.status !== "needs_information" || hasClarificationReply);
	const answerEntries = answerPairs(grievance.fields, grievance.answers);

	async function runAction(name: string, action: () => Promise<unknown>) {
		setPendingAction(name);
		setActionError(null);
		try {
			await action();
			await router.invalidate({ sync: true });
		} catch {
			setActionError(
				text({
					en: "That update could not be saved. Please try again.",
					hi: "यह बदलाव सहेजा नहीं जा सका। कृपया फिर से कोशिश करें।",
				}),
			);
		} finally {
			setPendingAction(null);
		}
	}

	function reply(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const message = clarification.trim();
		if (!message) {
			setActionError(
				text({
					en: "Write a reply before sending it.",
					hi: "भेजने से पहले उत्तर लिखें।",
				}),
			);
			return;
		}
		void runAction("reply", async () => {
			await replyToClarification({
				data: { registrationId: grievance.registrationId, message },
			});
			setClarification("");
		});
	}

	function sendFeedback(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!score) {
			setActionError(
				text({
					en: "Choose a score from 1 to 5.",
					hi: "1 से 5 के बीच एक अंक चुनें।",
				}),
			);
			return;
		}
		void runAction("feedback", () =>
			submitFeedback({
				data: {
					registrationId: grievance.registrationId,
					score,
					comment: comment.trim() || undefined,
				},
			}),
		);
	}

	function fileAppeal(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const reason = appealReason.trim();
		if (!reason) {
			setActionError(
				text({ en: "Explain why you are appealing.", hi: "अपील का कारण लिखें।" }),
			);
			return;
		}
		void runAction("appeal", () =>
			submitAppeal({
				data: { registrationId: grievance.registrationId, reason },
			}),
		);
	}

	return (
		<main className="page-shell">
			<Link
				className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[var(--blue-800)] no-underline hover:text-[var(--blue-950)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--blue-700)]"
				to="/grievances"
			>
				<ArrowLeft size={17} aria-hidden="true" />
				{text({ en: "My grievances", hi: "मेरी शिकायतें" })}
			</Link>

			<header className="mt-9 border-b-2 border-[var(--blue-700)] pb-7">
				<p className="page-eyebrow">
					{text({ en: "Grievance receipt", hi: "शिकायत रसीद" })}
				</p>
				<div className="mt-3 flex flex-wrap items-start justify-between gap-4">
					<div>
						<h1 className="page-title mt-0">{grievance.form.title}</h1>
						<p className="mt-3 font-mono text-sm font-bold tracking-wide text-[var(--blue-950)]">
							{grievance.registrationId}
						</p>
					</div>
					<StatusLabel status={grievance.status} />
				</div>
				<p className="mt-4 text-sm text-[var(--ink-muted)]">
					{text({ en: "Submitted", hi: "जमा किया" })}{" "}
					{formatDateTime(grievance.submittedAt)}
				</p>
			</header>

			<section
				className="border-b border-[var(--line)] py-8"
				aria-labelledby="submission-details-title"
			>
				<h2
					id="submission-details-title"
					className="text-xl font-bold text-[var(--blue-950)]"
				>
					{text({ en: "Submission details", hi: "जमा किए गए विवरण" })}
				</h2>
				<dl className="mt-5 border-t border-[var(--line)]">
					<Detail
						label={text({ en: "Authority", hi: "प्राधिकरण" })}
						value={grievance.organization.name}
					/>
					<Detail
						label={text({ en: "Category", hi: "श्रेणी" })}
						value={grievance.categoryPath.join(" › ")}
					/>
					<Detail
						label={text({ en: "Form", hi: "फ़ॉर्म" })}
						value={`${grievance.form.title} · ${text({ en: "Version", hi: "संस्करण" })} ${grievance.form.version}`}
					/>
					<Detail
						label={text({ en: "Language", hi: "भाषा" })}
						value={languageLabel(grievance.language)}
					/>
					<Detail
						label={text({ en: "Remarks", hi: "टिप्पणी" })}
						value={
							grievance.remarks ||
							text({ en: "Not provided", hi: "नहीं दिया गया" })
						}
						preserveWhitespace
					/>
				</dl>
			</section>

			<section
				className="border-b border-[var(--line)] py-8"
				aria-labelledby="answers-title"
			>
				<h2
					id="answers-title"
					className="text-xl font-bold text-[var(--blue-950)]"
				>
					{text({ en: "Submitted answers", hi: "जमा किए गए उत्तर" })}
				</h2>
				<dl className="mt-5 border-t border-[var(--line)]">
					{answerEntries.map(({ id, label, answer }) => (
						<Detail
							key={id}
							label={label}
							value={displayAnswer(answer)}
							preserveWhitespace
						/>
					))}
				</dl>
			</section>

			<section
				className="border-b border-[var(--line)] py-8"
				aria-labelledby="attachments-title"
			>
				<h2
					id="attachments-title"
					className="text-xl font-bold text-[var(--blue-950)]"
				>
					{text({ en: "Attachments", hi: "संलग्नक" })}
				</h2>
				{grievance.attachments.length ? (
					<ul className="mt-5 border-t border-[var(--line)]">
						{grievance.attachments.map((attachment) => (
							<li
								key={attachment.id}
								className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[var(--line)] py-4"
							>
								<a
									className="font-semibold text-[var(--blue-800)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue-700)]"
									href={`/api/attachments/${attachment.id}`}
									download
								>
									{attachment.name}
								</a>
								<span className="text-sm text-[var(--ink-muted)]">
									{attachment.mimeType} · {formatFileSize(attachment.sizeBytes)}
								</span>
							</li>
						))}
					</ul>
				) : (
					<p className="mt-3 text-sm text-[var(--ink-muted)]">
						{text({
							en: "No files were attached.",
							hi: "कोई फ़ाइल संलग्न नहीं की गई।",
						})}
					</p>
				)}
			</section>

			<section className="py-8" aria-labelledby="timeline-title">
				<h2
					id="timeline-title"
					className="text-xl font-bold text-[var(--blue-950)]"
				>
					{text({ en: "Updates", hi: "अपडेट" })}
				</h2>
				<ol className="relative mt-6 border-l-2 border-[var(--blue-200)] pl-6">
					{grievance.events.map((event) => (
						<li key={event.id} className="relative pb-8 last:pb-0">
							<span className="absolute -left-[2.05rem] top-1 grid size-4 place-items-center rounded-full border-2 border-[var(--blue-700)] bg-[var(--paper)]">
								{event.toStatus === "resolved" ? (
									<CircleCheck size={9} aria-hidden="true" />
								) : null}
							</span>
							<div className="flex flex-wrap items-center gap-2">
								<p className="font-bold text-[var(--blue-950)]">
									{eventTitle(event.eventType, event.toStatus)}
								</p>
								{event.toStatus ? (
									<StatusLabel status={event.toStatus} />
								) : null}
							</div>
							<p className="mt-1 text-xs font-medium text-[var(--ink-muted)]">
								{formatDateTime(event.createdAt)}
							</p>
							{event.message ? (
								<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--ink)]">
									{event.message}
								</p>
							) : null}
						</li>
					))}
				</ol>
			</section>

			{actionError ? (
				<p
					className="border-l-4 border-red-700 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900"
					role="alert"
				>
					{actionError}
				</p>
			) : null}

			<section
				className="border-t-2 border-[var(--blue-700)] pt-8"
				aria-labelledby="next-step-title"
			>
				<h2
					id="next-step-title"
					className="text-xl font-bold text-[var(--blue-950)]"
				>
					{text({ en: "Next step", hi: "अगला कदम" })}
				</h2>
				{canAdvanceDemo ? (
					<div className="mt-5 border-l-4 border-[var(--blue-700)] bg-[var(--blue-50)] px-4 py-4">
						<p className="text-sm leading-6 text-[var(--blue-950)]">
							{text({
								en: "Demo control. Advance this synthetic grievance by one lifecycle step.",
								hi: "डेमो नियंत्रण। इस कृत्रिम शिकायत को एक चरण आगे बढ़ाएं।",
							})}
						</p>
						<button
							className="action-secondary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
							type="button"
							disabled={pendingAction !== null}
							onClick={() =>
								void runAction("advance", () =>
									advanceDemoGrievance({
										data: { registrationId: grievance.registrationId },
									}),
								)
							}
						>
							{pendingAction === "advance"
								? text({ en: "Advancing...", hi: "आगे बढ़ाया जा रहा है..." })
								: text({ en: "Advance demo status", hi: "डेमो स्थिति आगे बढ़ाएं" })}
							<ChevronRight size={17} aria-hidden="true" />
						</button>
					</div>
				) : null}

				{grievance.status === "needs_information" && !hasClarificationReply ? (
					<form
						className="mt-6 border-l-4 border-[var(--blue-700)] pl-5"
						onSubmit={reply}
					>
						<label
							className="block text-sm font-bold text-[var(--blue-950)]"
							htmlFor="clarification-reply"
						>
							{text({
								en: "Reply to the clarification request",
								hi: "स्पष्टीकरण अनुरोध का उत्तर दें",
							})}
						</label>
						<textarea
							id="clarification-reply"
							className="field-control mt-3 min-h-28 resize-y"
							value={clarification}
							onChange={(event) => setClarification(event.target.value)}
						/>
						<button
							className="action-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
							type="submit"
							disabled={pendingAction !== null}
						>
							{pendingAction === "reply"
								? text({ en: "Sending...", hi: "भेजा जा रहा है..." })
								: text({ en: "Send reply", hi: "उत्तर भेजें" })}
							<Send size={16} aria-hidden="true" />
						</button>
					</form>
				) : null}

				{grievance.status === "resolved" && !grievance.feedback ? (
					<form
						className="mt-6 border-l-4 border-[var(--blue-700)] pl-5"
						onSubmit={sendFeedback}
					>
						<fieldset>
							<legend className="text-sm font-bold text-[var(--blue-950)]">
								{text({ en: "Rate this resolution", hi: "इस समाधान को अंक दें" })}
							</legend>
							<div className="mt-3 flex flex-wrap gap-2">
								{[1, 2, 3, 4, 5].map((value) => (
									<label key={value} className="cursor-pointer">
										<input
											className="peer sr-only"
											type="radio"
											name="score"
											value={value}
											checked={score === value}
											onChange={() => setScore(value)}
										/>
										<span className="grid size-11 place-items-center rounded-full border border-[var(--blue-400)] font-bold text-[var(--blue-900)] peer-checked:border-[var(--blue-800)] peer-checked:bg-[var(--blue-800)] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--blue-700)]">
											{value}
										</span>
									</label>
								))}
							</div>
						</fieldset>
						<label
							className="mt-5 block text-sm font-semibold text-[var(--blue-950)]"
							htmlFor="feedback-comment"
						>
							{text({ en: "Comment, optional", hi: "टिप्पणी, वैकल्पिक" })}
						</label>
						<textarea
							id="feedback-comment"
							className="field-control mt-2 min-h-24 resize-y"
							value={comment}
							onChange={(event) => setComment(event.target.value)}
						/>
						<button
							className="action-primary mt-4 disabled:opacity-50"
							type="submit"
							disabled={pendingAction !== null}
						>
							{pendingAction === "feedback"
								? text({ en: "Saving...", hi: "सहेजा जा रहा है..." })
								: text({ en: "Submit rating", hi: "अंक जमा करें" })}
						</button>
					</form>
				) : null}

				{grievance.feedback &&
				grievance.feedback.score <= 2 &&
				appealIsOpen &&
				!grievance.appeal ? (
					<form
						className="mt-6 border-l-4 border-amber-700 pl-5"
						onSubmit={fileAppeal}
					>
						<label
							className="block text-sm font-bold text-[var(--blue-950)]"
							htmlFor="appeal-reason"
						>
							{text({
								en: "Why are you appealing?",
								hi: "आप अपील क्यों कर रहे हैं?",
							})}
						</label>
						<p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
							{text({
								en: "Review this reason carefully. Submitting an appeal is final for this step.",
								hi: "कारण ध्यान से पढ़ें। इस चरण में अपील जमा करना अंतिम कार्रवाई है।",
							})}
						</p>
						<textarea
							id="appeal-reason"
							className="field-control mt-3 min-h-28 resize-y"
							value={appealReason}
							onChange={(event) => setAppealReason(event.target.value)}
						/>
						<button
							className="action-primary mt-4 disabled:opacity-50"
							type="submit"
							disabled={pendingAction !== null}
						>
							{pendingAction === "appeal"
								? text({
										en: "Submitting appeal...",
										hi: "अपील जमा की जा रही है...",
									})
								: text({ en: "Submit appeal", hi: "अपील जमा करें" })}
						</button>
					</form>
				) : null}
				{grievance.feedback &&
				grievance.feedback.score <= 2 &&
				grievance.status === "resolved" &&
				!appealIsOpen &&
				!grievance.appeal ? (
					<p className="mt-6 border-l-4 border-slate-400 pl-5 text-sm text-[var(--ink-muted)]">
						{text({
							en: "The appeal period for this grievance has ended.",
							hi: "इस शिकायत की अपील अवधि समाप्त हो गई है।",
						})}
					</p>
				) : null}
			</section>
		</main>
	);
}

function Detail({
	label,
	value,
	preserveWhitespace = false,
}: {
	label: string;
	value: string;
	preserveWhitespace?: boolean;
}) {
	return (
		<div className="grid gap-1 border-b border-[var(--line)] py-4 sm:grid-cols-[minmax(10rem,0.4fr)_1fr] sm:gap-5">
			<dt className="text-sm font-bold text-[var(--ink-muted)]">{label}</dt>
			<dd
				className={
					preserveWhitespace
						? "whitespace-pre-wrap break-words text-[var(--ink)]"
						: "break-words text-[var(--ink)]"
				}
			>
				{value}
			</dd>
		</div>
	);
}

function displayAnswer(value: unknown) {
	if (typeof value === "string") return value || "Not provided";
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (value === null || value === undefined) return "Not provided";
	return JSON.stringify(value);
}

function answerPairs(
	fields: Array<{ id: string; label: string }>,
	answers: Record<string, unknown>,
): Array<{ id: string; label: string; answer: unknown }> {
	const knownIds = new Set(fields.map((field) => field.id));
	const declared = fields.reduce<
		Array<{ id: string; label: string; answer: unknown }>
	>((items, field) => {
		if (field.id in answers)
			items.push({
				id: field.id,
				label: field.label,
				answer: answers[field.id],
			});
		return items;
	}, []);
	return [
		...declared,
		...Object.entries(answers)
			.filter(([id]) => !knownIds.has(id))
			.map(([id, answer]) => ({ id, label: id, answer })),
	];
}

function languageLabel(language: string) {
	return language === "hi" ? "Hindi" : language === "en" ? "English" : language;
}

function eventTitle(eventType: string, status: string | null) {
	if (eventType === "clarification_requested") return "Clarification requested";
	if (eventType === "clarification_replied") return "Clarification reply sent";
	if (eventType === "feedback_received") return "Resolution rated";
	if (eventType === "appeal_filed") return "Appeal submitted";
	if (eventType === "status_changed")
		return status
			? status
					.replaceAll("_", " ")
					.replace(/\b\w/g, (letter) => letter.toUpperCase())
			: "Status updated";
	return status
		? status
				.replaceAll("_", " ")
				.replace(/\b\w/g, (letter) => letter.toUpperCase())
		: eventType.replaceAll("_", " ");
}

function formatDateTime(value: string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? value
		: new Intl.DateTimeFormat(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(date);
}

function formatFileSize(bytes: number) {
	return bytes >= 1024 * 1024
		? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
		: `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function lastEventIndex(
	events: Array<{ eventType: string }>,
	eventType: string,
) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		if (events[index]?.eventType === eventType) return index;
	}
	return -1;
}
