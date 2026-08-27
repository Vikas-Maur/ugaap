import { clientTools } from "@tanstack/ai-client";
import {
	fetchServerSentEvents,
	useAudioRecorder,
	useChat,
} from "@tanstack/ai-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	ArrowRight,
	Bot,
	Check,
	LoaderCircle,
	LogIn,
	MessageSquareText,
	Mic,
	Send,
	Square,
	Trash2,
	TriangleAlert,
	Undo2,
	Wrench,
	X,
} from "lucide-react";
import {
	type CSSProperties,
	type FormEvent,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	recordingToGeminiAudio,
	TEXT_VOICE_MAX_DURATION_MS,
} from "#/features/assistant/audio";
import { useAssistantContext } from "#/features/assistant/context";
import {
	assistantRouteSummary,
	assistantRoutes,
	routeDefinitionForPath,
} from "#/features/assistant/routes";
import { assistantTranscriptionSchema } from "#/features/assistant/schema";
import { selectSpeechVoice } from "#/features/assistant/speech";
import {
	changeInterfaceLanguageDef,
	editVisibleFormDef,
	fillVisibleFormDef,
	getCurrentRecordStatusDef,
	getWorkspaceSummaryDef,
	listAuthoritiesDef,
	listAuthorityCategoriesDef,
	listWebsiteRoutesDef,
	navigateWebsiteDef,
	openGrievanceFormDef,
	requestSubmissionConfirmationDef,
	reviewVisibleFormDef,
	searchGrievanceCatalogueDef,
	submitConfirmedGrievanceDef,
} from "#/features/assistant/tools";
import { readableViewportContent } from "#/features/assistant/viewport";
import {
	findForm,
	loadAuthorityChunk,
	loadCatalogueDirectory,
	searchCataloguePage,
} from "#/features/catalogue/client";
import { text, useI18n } from "#/features/i18n/i18n";
import { authClient } from "#/lib/auth-client";
import { ScrollArea } from "./ui/scroll-area";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "./ui/sheet";

type AssistantMode = "text" | "local";

type ToolActivityState = "running" | "complete" | "error";

type CompactTranscriptItem = {
	id: string;
	kind: "message" | "tool";
	role?: "user" | "assistant";
	content: string;
	state?: ToolActivityState;
	timestamp: number;
};

type AssistantRecommendation = {
	formId: string;
	authoritySlug: string;
	authorityName: string;
	formTitle: string;
};

type AssistantMessagePart = {
	type: string;
	content?: unknown;
	name?: unknown;
	state?: unknown;
	output?: unknown;
};

const toolNames = {
	list_website_routes: {
		en: "Reading website routes",
		hi: "वेबसाइट के पेज देख रहा है",
	},
	list_authorities: { en: "Loading authorities", hi: "विभागों की सूची देख रहा है" },
	list_authority_categories: {
		en: "Loading grievance categories",
		hi: "शिकायत श्रेणियां देख रहा है",
	},
	get_workspace_summary: {
		en: "Checking your workspace",
		hi: "आपका कार्यक्षेत्र देख रहा है",
	},
	get_current_record_status: {
		en: "Checking grievance status",
		hi: "शिकायत की स्थिति देख रहा है",
	},
	navigate_website: {
		en: "Opening the requested page",
		hi: "मांगा गया पेज खोल रहा है",
	},
	change_interface_language: {
		en: "Changing the language",
		hi: "भाषा बदल रहा है",
	},
	search_grievance_catalogue: {
		en: "Searching the grievance catalogue",
		hi: "शिकायत सूची में खोज रहा है",
	},
	open_grievance_form: {
		en: "Opening the grievance form",
		hi: "शिकायत फॉर्म खोल रहा है",
	},
	fill_visible_form: {
		en: "Filling the visible form",
		hi: "दिख रहा फॉर्म भर रहा है",
	},
	review_visible_form: { en: "Reviewing the form", hi: "फॉर्म की जांच कर रहा है" },
	edit_visible_form: {
		en: "Returning to form editing",
		hi: "फॉर्म में बदलाव के लिए लौट रहा है",
	},
	request_submission_confirmation: {
		en: "Preparing submission confirmation",
		hi: "जमा करने की पुष्टि तैयार कर रहा है",
	},
	submit_confirmed_grievance: {
		en: "Submitting the grievance",
		hi: "शिकायत जमा कर रहा है",
	},
} as const;

const voiceWaveBarIds = Array.from(
	{ length: 96 },
	(_, index) => `voice-wave-${index}`,
);

function toolActivityName(name: string, language: "en" | "hi") {
	const known = toolNames[name as keyof typeof toolNames];
	if (known) return known[language];
	return name.replaceAll("_", " ");
}

function toolActivityState(state?: string): ToolActivityState {
	if (state === "error") return "error";
	if (state === "complete") return "complete";
	return "running";
}

function VoiceWaveform({
	phase,
	live,
	waveformRef,
}: {
	phase: "connecting" | "listening" | "speaking";
	live: boolean;
	waveformRef: RefObject<HTMLSpanElement | null>;
}) {
	return (
		<span
			ref={waveformRef}
			className="voice-waveform"
			data-phase={phase}
			data-live={live}
			aria-hidden="true"
		>
			{voiceWaveBarIds.map((barId) => (
				<span
					key={barId}
					className="voice-wave-bar"
					style={{ "--voice-scale": 0 } as CSSProperties}
				/>
			))}
		</span>
	);
}

function elapsedVoiceTime(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function completedSpeechLength(content: string, start: number) {
	let end = start;
	for (let index = start; index < content.length; index += 1) {
		if (".!?।\n".includes(content[index] ?? "")) end = index + 1;
	}
	return end;
}

function messageText(parts: ReadonlyArray<AssistantMessagePart>) {
	return parts
		.flatMap((part) =>
			part.type === "text" && typeof part.content === "string"
				? [part.content]
				: [],
		)
		.join(" ");
}

function assistantReplyText(parts: ReadonlyArray<AssistantMessagePart>) {
	return messageText(parts).trim();
}

function canonicalFormDestination(authoritySlug: string, formId: string) {
	const search = new URLSearchParams({ form: formId, review: "false" });
	return `/services/${encodeURIComponent(authoritySlug)}?${search.toString()}`;
}

export function AssistantLauncher() {
	const { language, setLanguage, text: translate } = useI18n();
	const { data: session } = authClient.useSession();
	const navigate = useNavigate();
	const location = useRouterState({
		select: (state) => state.location,
	});
	const pathname = location.pathname;
	const currentRoute = routeDefinitionForPath(pathname) ?? null;
	const {
		currentForm,
		applyFields,
		undoLastFill,
		canUndo,
		beginUserTurn,
		reviewVisibleForm,
		editVisibleForm,
		requestSubmissionConfirmation,
		submitConfirmedGrievance,
		pendingSubmission,
		cancelPendingSubmission,
	} = useAssistantContext();
	const [input, setInput] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [textVoicePending, setTextVoicePending] = useState(false);
	const [textVoiceSpeaking, setTextVoiceSpeaking] = useState(false);
	const [voiceElapsedSeconds, setVoiceElapsedSeconds] = useState(0);
	const [voiceRequested, setVoiceRequested] = useState(false);
	const [assistantMode, setAssistantMode] = useState<AssistantMode>("text");
	const [pageContent, setPageContent] = useState("");
	const finishTextRecordingRef = useRef<() => Promise<void>>(
		async () => undefined,
	);
	const textVoiceStopTimerRef = useRef(0);
	const textVoiceFinishingRef = useRef(false);
	const speakFallbackRef = useRef(false);
	const textVoiceBaselineRef = useRef<string | null>(null);
	const textVoiceReplyRef = useRef<string | null>(null);
	const textVoiceSpokenLengthRef = useRef(0);
	const textVoiceSpeechPendingRef = useRef(0);
	const textVoiceResponseFinishedRef = useRef(false);
	const messageLanguageRef = useRef<"en" | "hi" | null>(null);
	const voiceRequestedRef = useRef(false);
	const compactTranscriptRef = useRef<HTMLDivElement>(null);
	const compactTranscriptFollowsRef = useRef(true);
	const textVoiceWaveformRef = useRef<HTMLSpanElement>(null);
	const textVoiceVisualizerStreamRef = useRef<MediaStream | null>(null);
	const textVoiceVisualizerContextRef = useRef<AudioContext | null>(null);
	const textVoiceVisualizerFrameRef = useRef(0);
	const textVoiceVisualizerPaintRef = useRef(0);
	const voiceTimerStartedAtRef = useRef(0);
	const {
		isRecording: textVoiceRecording,
		isSupported: textVoiceSupported,
		start: startTextRecorder,
		stop: stopTextRecorder,
		cancel: cancelTextRecorder,
	} = useAudioRecorder({
		audio: {
			autoGainControl: true,
			echoCancellation: true,
			noiseSuppression: true,
		},
	});
	const applyFieldsRef = useRef(applyFields);
	const navigateRef = useRef(navigate);
	const sessionRef = useRef(session);
	const setLanguageRef = useRef(setLanguage);
	const currentFormRef = useRef(currentForm);
	const reviewVisibleFormRef = useRef(reviewVisibleForm);
	const editVisibleFormRef = useRef(editVisibleForm);
	const requestSubmissionConfirmationRef = useRef(
		requestSubmissionConfirmation,
	);
	const submitConfirmedGrievanceRef = useRef(submitConfirmedGrievance);
	applyFieldsRef.current = applyFields;
	navigateRef.current = navigate;
	sessionRef.current = session;
	setLanguageRef.current = setLanguage;
	currentFormRef.current = currentForm;
	reviewVisibleFormRef.current = reviewVisibleForm;
	editVisibleFormRef.current = editVisibleForm;
	requestSubmissionConfirmationRef.current = requestSubmissionConfirmation;
	submitConfirmedGrievanceRef.current = submitConfirmedGrievance;
	const requestContextRef = useRef({
		language,
		pathname,
		route: currentRoute,
		currentForm,
		pageContent,
	});
	requestContextRef.current = {
		language,
		pathname,
		route: currentRoute,
		currentForm,
		pageContent,
	};
	const pageIdentity = `${location.href}:${language}`;

	useEffect(() => {
		if (!pageIdentity) return;
		let frame = 0;
		let observer: MutationObserver | null = null;
		const refresh = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const next = readableViewportContent();
				setPageContent((current) => (current === next ? current : next));
			});
		};
		refresh();
		const root = document.querySelector<HTMLElement>(
			"[data-assistant-page-content]",
		);
		if (root) {
			observer = new MutationObserver(refresh);
			observer.observe(root, {
				childList: true,
				subtree: true,
				characterData: true,
			});
		}
		window.addEventListener("scroll", refresh, { passive: true });
		window.addEventListener("resize", refresh);
		return () => {
			cancelAnimationFrame(frame);
			observer?.disconnect();
			window.removeEventListener("scroll", refresh);
			window.removeEventListener("resize", refresh);
		};
	}, [pageIdentity]);

	const connection = useMemo(
		() =>
			fetchServerSentEvents("/api/ai/chat", () => {
				const context = requestContextRef.current;
				return {
					credentials: "same-origin",
					body: {
						language: context.language,
						messageLanguage: messageLanguageRef.current,
						pathname: context.pathname,
						route: context.route
							? {
									destination: context.route.destination,
									label: context.route.label,
									purpose: context.route.purpose,
									access: context.route.access,
								}
							: null,
						pageContent: context.pageContent,
						currentForm: context.currentForm
							? {
									id: context.currentForm.form.id,
									title: context.currentForm.form.title,
									heading: context.currentForm.form.heading,
									categoryPath: context.currentForm.form.categoryPath,
									stage: context.currentForm.stage,
									fields: context.currentForm.form.fields.map((field) => ({
										id: field.id,
										label: field.label,
										kind: field.kind,
										required: field.required,
										...(field.placeholder
											? { placeholder: field.placeholder }
											: {}),
										...(field.maximumLength
											? { maximumLength: field.maximumLength }
											: {}),
										...(field.pattern ? { pattern: field.pattern } : {}),
										...(field.options ? { options: field.options } : {}),
										value: context.currentForm?.values[field.id] ?? "",
										error: context.currentForm?.errors[field.id] ?? null,
									})),
								}
							: null,
					},
				};
			}),
		[],
	);

	const assistantTools = useMemo(() => {
		const searchTool = searchGrievanceCatalogueDef.client(async (request) => {
			const response = await searchCataloguePage(request);
			return {
				...response,
				results: response.results.map((result) => ({
					id: result.id,
					authoritySlug: result.authoritySlug,
					authorityName: result.authorityName,
					categoryId: result.categoryId,
					title: result.title,
					categoryPath: result.categoryPath,
				})),
				status: response.results.length
					? ("found" as const)
					: ("not-found" as const),
				catalogueOnly: true as const,
			};
		});
		const routesTool = listWebsiteRoutesDef.client(async () => ({
			routes: assistantRouteSummary(),
		}));
		const authoritiesTool = listAuthoritiesDef.client(async () => {
			const directory = await loadCatalogueDirectory();
			return {
				authorities: directory.authorities.map((authority) => ({
					slug: authority.slug,
					name: authority.name,
					categoryCount: authority.categoryCount,
					formCount: authority.formCount,
				})),
			};
		});
		const categoriesTool = listAuthorityCategoriesDef.client(
			async ({ authoritySlug, parentCategoryId }) => {
				const chunk = await loadAuthorityChunk(authoritySlug);
				return {
					authorityName: chunk.authority.name,
					categories: chunk.categories
						.filter((category) => category.parentId === parentCategoryId)
						.slice(0, 80)
						.map((category) => ({
							id: category.id,
							name: category.name,
							path: category.path,
							hasChildren: category.children.length > 0,
							formId: category.formId ?? null,
						})),
				};
			},
		);
		const workspaceTool = getWorkspaceSummaryDef.client(async () => {
			if (!sessionRef.current?.user)
				return {
					status: "requires-auth" as const,
					citizenName: null,
					needsReply: [],
					drafts: [],
					active: [],
					recentlyResolved: [],
				};
			const { getCitizenDashboard } = await import(
				"#/features/dashboard/functions"
			);
			const summary = await getCitizenDashboard();
			return { status: "ok" as const, ...summary };
		});
		const currentRecordTool = getCurrentRecordStatusDef.client(async () => {
			if (!sessionRef.current?.user)
				return {
					status: "requires-auth" as const,
					kind: null,
					record: null,
					reason: "Sign in is required to read a grievance record.",
				};
			const match = requestContextRef.current.pathname.match(
				/^\/grievances\/([^/]+)\/?$/,
			);
			if (!match?.[1])
				return {
					status: "unavailable" as const,
					kind: null,
					record: null,
					reason: "No grievance detail page is currently open.",
				};
			const { getGrievance } = await import("#/features/grievances/functions");
			const record = await getGrievance({
				data: { registrationId: decodeURIComponent(match[1]) },
			});
			return {
				status: "ok" as const,
				kind: "grievance" as const,
				record,
				reason: "The current grievance record was loaded.",
			};
		});
		const openTool = openGrievanceFormDef.client(
			async ({ authoritySlug, formId }) => {
				try {
					const chunk = await loadAuthorityChunk(authoritySlug);
					if (!findForm(chunk, formId))
						return {
							opened: false,
							requiresLogin: false,
							reason: "The route is not in the catalogue.",
						};
					const destination = canonicalFormDestination(authoritySlug, formId);
					if (!sessionRef.current?.user) {
						await navigateRef.current({
							to: "/login",
							search: { redirect: destination },
						});
						return {
							opened: false,
							requiresLogin: true,
							reason: "Sign in is required before the form opens.",
						};
					}
					await navigateRef.current({
						to: "/services/$authoritySlug",
						params: { authoritySlug },
						search: { form: formId, review: false, draft: undefined },
					});
					return {
						opened: true,
						requiresLogin: false,
						reason: "Verified form opened.",
					};
				} catch {
					return {
						opened: false,
						requiresLogin: false,
						reason: "The route could not be verified.",
					};
				}
			},
		);
		const navigationTool = navigateWebsiteDef.client(async (request) => {
			const route = assistantRoutes.find(
				(candidate) => candidate.destination === request.destination,
			);
			if (!route)
				return {
					status: "unavailable" as const,
					path: requestContextRef.current.pathname,
					reason: "That page is not registered.",
				};
			const parameter = route.requiredParameter
				? request[route.requiredParameter]
				: undefined;
			if (route.requiredParameter && !parameter)
				return {
					status: "unavailable" as const,
					path: requestContextRef.current.pathname,
					reason: `The ${route.requiredParameter} is required.`,
				};
			const targetPath = route.requiredParameter
				? route.path.replace(
						`$${route.requiredParameter}`,
						encodeURIComponent(parameter ?? ""),
					)
				: route.path;
			if (route.access === "authenticated" && !sessionRef.current?.user) {
				await navigateRef.current({
					to: "/login",
					search: { redirect: targetPath },
				});
				return {
					status: "requires-auth" as const,
					path: "/login",
					reason: "Sign in is required before opening that page.",
				};
			}
			switch (request.destination) {
				case "home":
					await navigateRef.current({ to: "/" });
					break;
				case "about":
					await navigateRef.current({ to: "/about" });
					break;
				case "public-grievances":
					await navigateRef.current({
						to: "/public-grievances",
						search: {
							q: "",
							status: "all",
							organization: "all",
							category: "all",
							sort: "recent",
						},
					});
					break;
				case "public-grievance":
					await navigateRef.current({
						to: "/public-grievances/$publicId",
						params: { publicId: request.publicId ?? "" },
					});
					break;
				case "accountability":
					await navigateRef.current({
						to: "/accountability",
						search: { group: "central", windowDays: 90 },
					});
					break;
				case "authority-accountability":
					await navigateRef.current({
						to: "/accountability/authorities/$authoritySlug",
						params: { authoritySlug: request.authoritySlug ?? "" },
						search: { windowDays: 90 },
					});
					break;
				case "methodology":
					await navigateRef.current({ to: "/methodology" });
					break;
				case "terms":
					await navigateRef.current({ to: "/terms" });
					break;
				case "privacy":
					await navigateRef.current({ to: "/privacy" });
					break;
				case "cookies":
					await navigateRef.current({ to: "/cookies" });
					break;
				case "login":
					await navigateRef.current({
						to: "/login",
						search: { redirect: "/dashboard" },
					});
					break;
				case "register":
					await navigateRef.current({
						to: "/register",
						search: { redirect: "/dashboard" },
					});
					break;
				case "dashboard":
					await navigateRef.current({ to: "/dashboard" });
					break;
				case "services":
					await navigateRef.current({ to: "/services", search: { q: "" } });
					break;
				case "authority":
					await navigateRef.current({
						to: "/services/$authoritySlug",
						params: { authoritySlug: request.authoritySlug ?? "" },
						search: { form: undefined, review: false, draft: undefined },
					});
					break;
				case "drafts":
					await navigateRef.current({ to: "/drafts" });
					break;
				case "continuation":
					await navigateRef.current({ to: "/continuation" });
					break;
				case "grievances":
					await navigateRef.current({ to: "/grievances" });
					break;
				case "grievance":
					await navigateRef.current({
						to: "/grievances/$registrationId",
						params: { registrationId: request.registrationId ?? "" },
					});
					break;
			}
			return {
				status: "ok" as const,
				path: targetPath,
				reason: `${route.label} opened.`,
			};
		});
		const languageTool = changeInterfaceLanguageDef.client(({ language }) => {
			setLanguageRef.current(language);
			return { status: "ok" as const, language };
		});
		const fillTool = fillVisibleFormDef.client(({ fields }) =>
			applyFieldsRef.current(fields),
		);
		const reviewTool = reviewVisibleFormDef.client(async () => {
			const result = await reviewVisibleFormRef.current();
			return {
				status: result.status,
				reason: result.reason,
				missingFields: result.missingFields ?? [],
			};
		});
		const editTool = editVisibleFormDef.client(() =>
			editVisibleFormRef.current(),
		);
		const confirmationTool = requestSubmissionConfirmationDef.client(() => {
			const result = requestSubmissionConfirmationRef.current();
			return {
				status: result.status,
				reason: result.reason,
				confirmationId: result.confirmationId ?? null,
			};
		});
		const submitTool = submitConfirmedGrievanceDef.client(
			async ({ confirmationId }) => {
				const result =
					await submitConfirmedGrievanceRef.current(confirmationId);
				return {
					status: result.status,
					reason: result.reason,
					registrationId: result.registrationId ?? null,
				};
			},
		);
		return clientTools(
			routesTool,
			authoritiesTool,
			categoriesTool,
			searchTool,
			workspaceTool,
			currentRecordTool,
			openTool,
			navigationTool,
			languageTool,
			fillTool,
			reviewTool,
			editTool,
			confirmationTool,
			submitTool,
		);
	}, []);

	const chatState = useChat({
		connection,
		tools: assistantTools,
		onError: () => {
			const failedVoiceTurn = speakFallbackRef.current;
			speakFallbackRef.current = false;
			setTextVoicePending(false);
			setTextVoiceSpeaking(false);
			if (failedVoiceTurn) {
				voiceRequestedRef.current = false;
				setVoiceRequested(false);
			}
			setNotice(
				translate(
					text({
						en: "The guide could not answer just now. You can still use the grievance catalogue manually.",
						hi: "मार्गदर्शक अभी जवाब नहीं दे सका। आप शिकायत सूची का इस्तेमाल फिर भी कर सकते हैं।",
					}),
				),
			);
		},
	});
	const latestAssistantReply = useMemo(() => {
		for (let index = chatState.messages.length - 1; index >= 0; index -= 1) {
			const message = chatState.messages[index];
			if (message?.role !== "assistant") continue;
			const content = assistantReplyText(message.parts);
			if (content) return { id: message.id, content };
		}
		return null;
	}, [chatState.messages]);
	const finishVoiceTurn = useCallback(() => {
		if (!speakFallbackRef.current) return;
		speakFallbackRef.current = false;
		textVoiceSpeechPendingRef.current = 0;
		textVoiceResponseFinishedRef.current = false;
		setTextVoicePending(false);
		setTextVoiceSpeaking(false);
		voiceRequestedRef.current = false;
		setVoiceRequested(false);
	}, []);
	const queueVoiceSpeech = useCallback(
		(content: string) => {
			if (!content.trim()) return;
			if (typeof window === "undefined" || !("speechSynthesis" in window)) {
				finishVoiceTurn();
				return;
			}

			const language = /[\u0900-\u097f]/.test(content) ? "hi" : "en";
			const utterance = new SpeechSynthesisUtterance(content.trim());
			const voice = selectSpeechVoice(
				window.speechSynthesis.getVoices(),
				language,
			);
			utterance.lang = voice?.lang ?? (language === "hi" ? "hi-IN" : "en-IN");
			if (voice) utterance.voice = voice;
			utterance.rate = language === "hi" ? 0.94 : 0.97;
			utterance.pitch = 1;
			textVoiceSpeechPendingRef.current += 1;
			let settled = false;
			const settle = () => {
				if (settled) return;
				settled = true;
				textVoiceSpeechPendingRef.current = Math.max(
					0,
					textVoiceSpeechPendingRef.current - 1,
				);
				if (
					textVoiceResponseFinishedRef.current &&
					textVoiceSpeechPendingRef.current === 0
				) {
					finishVoiceTurn();
				}
			};
			utterance.onstart = () => setTextVoiceSpeaking(true);
			utterance.onend = settle;
			utterance.onerror = settle;
			try {
				window.speechSynthesis.speak(utterance);
			} catch {
				settle();
			}
		},
		[finishVoiceTurn],
	);

	useEffect(() => {
		if (!speakFallbackRef.current || !textVoicePending) return;
		if (
			!latestAssistantReply ||
			latestAssistantReply.id === textVoiceBaselineRef.current
		) {
			if (!chatState.isLoading) finishVoiceTurn();
			return;
		}

		if (textVoiceReplyRef.current !== latestAssistantReply.id) {
			textVoiceReplyRef.current = latestAssistantReply.id;
			textVoiceSpokenLengthRef.current = 0;
			setNotice(null);
		}
		const start = textVoiceSpokenLengthRef.current;
		const end = chatState.isLoading
			? completedSpeechLength(latestAssistantReply.content, start)
			: latestAssistantReply.content.length;
		if (end > start) {
			textVoiceSpokenLengthRef.current = end;
			queueVoiceSpeech(latestAssistantReply.content.slice(start, end));
		}
		if (!chatState.isLoading) {
			textVoiceResponseFinishedRef.current = true;
			if (textVoiceSpeechPendingRef.current === 0) finishVoiceTurn();
		}
	}, [
		chatState.isLoading,
		finishVoiceTurn,
		latestAssistantReply,
		queueVoiceSpeech,
		textVoicePending,
	]);

	const setVoiceEnabled = useCallback((enabled: boolean) => {
		voiceRequestedRef.current = enabled;
		setVoiceRequested(enabled);
	}, []);

	const clearTextVoiceStopTimer = useCallback(() => {
		if (!textVoiceStopTimerRef.current) return;
		window.clearTimeout(textVoiceStopTimerRef.current);
		textVoiceStopTimerRef.current = 0;
	}, []);

	const stopTextVoiceVisualizer = useCallback(() => {
		if (textVoiceVisualizerFrameRef.current) {
			window.cancelAnimationFrame(textVoiceVisualizerFrameRef.current);
			textVoiceVisualizerFrameRef.current = 0;
		}
		textVoiceVisualizerStreamRef.current?.getTracks().forEach((track) => {
			track.stop();
		});
		textVoiceVisualizerStreamRef.current = null;
		const context = textVoiceVisualizerContextRef.current;
		textVoiceVisualizerContextRef.current = null;
		if (context && context.state !== "closed") {
			void context.close().catch(() => undefined);
		}
		for (const bar of textVoiceWaveformRef.current?.querySelectorAll<HTMLElement>(
			".voice-wave-bar",
		) ?? []) {
			bar.style.setProperty("--voice-scale", "0");
		}
	}, []);

	const startTextVoiceVisualizer = useCallback(async () => {
		stopTextVoiceVisualizer();
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					autoGainControl: true,
					echoCancellation: true,
					noiseSuppression: true,
				},
			});
			if (!voiceRequestedRef.current) {
				stream.getTracks().forEach((track) => {
					track.stop();
				});
				return;
			}
			const context = new AudioContext();
			const source = context.createMediaStreamSource(stream);
			const analyser = context.createAnalyser();
			analyser.fftSize = 1024;
			source.connect(analyser);
			await context.resume();
			textVoiceVisualizerStreamRef.current = stream;
			textVoiceVisualizerContextRef.current = context;
			const audioData = new Uint8Array(analyser.fftSize);
			const samples = voiceWaveBarIds.map(() => 0);
			let smoothedAmplitude = 0;
			const draw = (timestamp: number) => {
				analyser.getByteTimeDomainData(audioData);
				let sumOfSquares = 0;
				for (const sample of audioData) {
					const normalized = (sample - 128) / 128;
					sumOfSquares += normalized * normalized;
				}
				const rms = Math.sqrt(sumOfSquares / audioData.length);
				const noiseGated = Math.max(0, (rms - 0.006) * 11);
				const targetAmplitude = Math.min(1, noiseGated ** 0.7);
				const response = targetAmplitude > smoothedAmplitude ? 0.24 : 0.09;
				smoothedAmplitude += (targetAmplitude - smoothedAmplitude) * response;

				if (timestamp - textVoiceVisualizerPaintRef.current >= 85) {
					textVoiceVisualizerPaintRef.current = timestamp;
					samples.copyWithin(0, 1);
					samples[samples.length - 1] = smoothedAmplitude;
					const bars =
						textVoiceWaveformRef.current?.querySelectorAll<HTMLElement>(
							".voice-wave-bar",
						);
					if (bars) {
						bars.forEach((bar, index) => {
							const amplitude = samples[index] ?? 0;
							const scale = amplitude > 0.015 ? 0.1 + amplitude * 0.9 : 0;
							bar.style.setProperty("--voice-scale", scale.toFixed(3));
						});
					}
				}
				textVoiceVisualizerFrameRef.current =
					window.requestAnimationFrame(draw);
			};
			textVoiceVisualizerFrameRef.current = window.requestAnimationFrame(draw);
		} catch {
			stopTextVoiceVisualizer();
		}
	}, [stopTextVoiceVisualizer]);

	async function submit(event?: FormEvent) {
		event?.preventDefault();
		const message = input.trim();
		if (!message || chatState.isLoading) return;
		setNotice(null);
		beginUserTurn();
		setInput("");
		messageLanguageRef.current = null;
		await chatState.sendMessage(message);
	}

	const finishTextVoiceRecording = useCallback(async () => {
		if (!textVoiceRecording || textVoiceFinishingRef.current) return;
		textVoiceFinishingRef.current = true;
		let processingStage: "recording" | "transcription" | "assistant" =
			"recording";
		clearTextVoiceStopTimer();
		stopTextVoiceVisualizer();
		setTextVoicePending(true);
		setTextVoiceSpeaking(false);
		setNotice(
			translate(
				text({
					en: "Preparing your recording…",
					hi: "आपकी रिकॉर्डिंग तैयार की जा रही है…",
				}),
			),
		);
		try {
			const recording = await stopTextRecorder();
			if (recording.durationMs < 400)
				throw new Error("The recording was too short.");
			const audioPart = await recordingToGeminiAudio(recording.blob);
			if (!voiceRequestedRef.current) return;
			processingStage = "transcription";
			const response = await fetch("/api/ai/transcribe", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					audio: audioPart.source.value,
					mimeType: audioPart.source.mimeType,
				}),
			});
			if (!response.ok) throw new Error("Transcription failed.");
			const transcription = assistantTranscriptionSchema.safeParse(
				await response.json(),
			);
			if (!transcription.success)
				throw new Error("The transcription response was invalid.");
			const transcript = transcription.data.transcript.trim();
			if (!transcript) {
				setTextVoicePending(false);
				setVoiceEnabled(false);
				setNotice(
					translate(
						text({
							en: "No clear speech was detected. Check your microphone and try again.",
							hi: "कोई साफ़ आवाज़ नहीं मिली। माइक्रोफ़ोन जाँचकर फिर कोशिश करें।",
						}),
					),
				);
				return;
			}

			beginUserTurn();
			speakFallbackRef.current = true;
			textVoiceBaselineRef.current = latestAssistantReply?.id ?? null;
			textVoiceReplyRef.current = null;
			textVoiceSpokenLengthRef.current = 0;
			textVoiceSpeechPendingRef.current = 0;
			textVoiceResponseFinishedRef.current = false;
			setNotice(
				translate(
					text({
						en: "Transcript ready. Preparing a response…",
						hi: "लिखा हुआ संदेश तैयार है। जवाब तैयार हो रहा है…",
					}),
				),
			);
			messageLanguageRef.current = transcription.data.language;
			processingStage = "assistant";
			try {
				await chatState.sendMessage(transcript);
			} finally {
				messageLanguageRef.current = null;
			}
		} catch (error) {
			speakFallbackRef.current = false;
			setTextVoicePending(false);
			setTextVoiceSpeaking(false);
			setVoiceEnabled(false);
			const permissionDenied =
				error instanceof DOMException &&
				(error.name === "NotAllowedError" || error.name === "SecurityError");
			const recordingTooShort =
				error instanceof Error &&
				error.message === "The recording was too short.";
			setNotice(
				translate(
					permissionDenied
						? text({
								en: "Microphone access was blocked. Allow microphone access, then try again.",
								hi: "माइक्रोफ़ोन की अनुमति नहीं मिली। अनुमति देकर फिर कोशिश करें।",
							})
						: processingStage === "assistant"
							? text({
									en: "I heard your message, but the guide could not answer. Please send it again.",
									hi: "आपका संदेश सुन लिया गया, लेकिन मार्गदर्शक जवाब नहीं दे सका। कृपया इसे फिर से भेजें।",
								})
							: recordingTooShort
								? text({
										en: "The recording was too short. Speak for a moment longer and try again.",
										hi: "रिकॉर्डिंग बहुत छोटी थी। थोड़ा और बोलकर फिर कोशिश करें।",
									})
								: processingStage === "transcription"
									? text({
											en: "I could not understand that recording. Please record it again or type your message.",
											hi: "रिकॉर्डिंग समझ में नहीं आई। कृपया फिर से रिकॉर्ड करें या संदेश टाइप करें।",
										})
									: text({
											en: "The recording could not be prepared. Please record it again.",
											hi: "रिकॉर्डिंग तैयार नहीं हो सकी। कृपया फिर से रिकॉर्ड करें।",
										}),
				),
			);
		} finally {
			textVoiceFinishingRef.current = false;
		}
	}, [
		beginUserTurn,
		chatState.sendMessage,
		clearTextVoiceStopTimer,
		latestAssistantReply?.id,
		setVoiceEnabled,
		stopTextVoiceVisualizer,
		stopTextRecorder,
		textVoiceRecording,
		translate,
	]);
	finishTextRecordingRef.current = finishTextVoiceRecording;

	const startTextVoiceRecording = useCallback(async () => {
		if (!textVoiceSupported) {
			setVoiceEnabled(false);
			setNotice(
				translate(
					text({
						en: "Voice recording is not supported here. You can continue by typing.",
						hi: "यहाँ वॉइस रिकॉर्डिंग उपलब्ध नहीं है। आप टाइप करके जारी रख सकते हैं।",
					}),
				),
			);
			return;
		}
		if (typeof window !== "undefined" && "speechSynthesis" in window)
			window.speechSynthesis.cancel();
		setTextVoicePending(false);
		setTextVoiceSpeaking(false);
		try {
			await startTextRecorder();
			if (!voiceRequestedRef.current) {
				cancelTextRecorder();
				return;
			}
			void startTextVoiceVisualizer();
			setNotice(
				translate(
					text({
						en: "Recording. Tap voice again to stop and send.",
						hi: "रिकॉर्डिंग चालू है। रोककर भेजने के लिए वॉइस फिर दबाएँ।",
					}),
				),
			);
			clearTextVoiceStopTimer();
			textVoiceStopTimerRef.current = window.setTimeout(
				() => void finishTextRecordingRef.current(),
				TEXT_VOICE_MAX_DURATION_MS,
			);
		} catch (error) {
			setVoiceEnabled(false);
			const permissionDenied =
				error instanceof DOMException &&
				(error.name === "NotAllowedError" || error.name === "SecurityError");
			setNotice(
				translate(
					permissionDenied
						? text({
								en: "Microphone access was blocked. Allow microphone access, then try again.",
								hi: "माइक्रोफ़ोन की अनुमति नहीं मिली। अनुमति देकर फिर कोशिश करें।",
							})
						: text({
								en: "Voice recording could not start. Try again or type your message.",
								hi: "वॉइस रिकॉर्डिंग शुरू नहीं हो सकी। दोबारा कोशिश करें या संदेश टाइप करें।",
							}),
				),
			);
		}
	}, [
		cancelTextRecorder,
		clearTextVoiceStopTimer,
		setVoiceEnabled,
		startTextRecorder,
		startTextVoiceVisualizer,
		textVoiceSupported,
		translate,
	]);

	async function stopVoice() {
		setVoiceEnabled(false);
		clearTextVoiceStopTimer();
		stopTextVoiceVisualizer();
		cancelTextRecorder();
		speakFallbackRef.current = false;
		textVoiceSpeechPendingRef.current = 0;
		textVoiceResponseFinishedRef.current = false;
		setTextVoicePending(false);
		setTextVoiceSpeaking(false);
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.cancel();
		}
	}

	async function cancelVoiceInput() {
		setNotice(null);
		await stopVoice();
	}

	async function stopAssistant() {
		chatState.stop();
		if (voiceRequestedRef.current || textVoiceRecording) {
			await stopVoice();
		} else if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.cancel();
		}
		setNotice(translate(text({ en: "Stopped.", hi: "रोक दिया गया।" })));
	}

	async function toggleVoice() {
		setNotice(null);
		if (voiceRequestedRef.current) {
			if (textVoiceRecording) {
				await finishTextVoiceRecording();
				return;
			}
			await stopVoice();
			return;
		}
		setVoiceEnabled(true);
		if (voiceRequestedRef.current) await startTextVoiceRecording();
	}

	useEffect(
		() => () => {
			voiceRequestedRef.current = false;
			if (textVoiceStopTimerRef.current)
				window.clearTimeout(textVoiceStopTimerRef.current);
			cancelTextRecorder();
			stopTextVoiceVisualizer();
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		},
		[cancelTextRecorder, stopTextVoiceVisualizer],
	);

	async function openRecommendation(recommendation: AssistantRecommendation) {
		const destination = canonicalFormDestination(
			recommendation.authoritySlug,
			recommendation.formId,
		);
		if (!session?.user) {
			await navigate({ to: "/login", search: { redirect: destination } });
			return;
		}
		await navigate({
			to: "/services/$authoritySlug",
			params: { authoritySlug: recommendation.authoritySlug },
			search: {
				form: recommendation.formId,
				review: false,
				draft: undefined,
			},
		});
	}

	const voiceActive = voiceRequested;
	useEffect(() => {
		if (!voiceActive) {
			voiceTimerStartedAtRef.current = 0;
			setVoiceElapsedSeconds(0);
			return;
		}
		if (!textVoiceRecording) return;
		if (!voiceTimerStartedAtRef.current) {
			voiceTimerStartedAtRef.current = Date.now();
			setVoiceElapsedSeconds(0);
		}
		const timer = window.setInterval(() => {
			setVoiceElapsedSeconds(
				Math.floor((Date.now() - voiceTimerStartedAtRef.current) / 1000),
			);
		}, 250);
		return () => window.clearInterval(timer);
	}, [textVoiceRecording, voiceActive]);
	const assistantBusy = voiceActive || chatState.isLoading;
	const latestDockReply = latestAssistantReply?.content;
	const voiceStatus = textVoiceRecording
		? translate(
				text({
					en: "Recording now. Tap voice to stop and send.",
					hi: "रिकॉर्डिंग चालू है। रोककर भेजने के लिए वॉइस दबाएँ।",
				}),
			)
		: textVoiceSpeaking
			? translate(text({ en: "UGAAP is speaking…", hi: "UGAAP बोल रहा है…" }))
			: textVoicePending
				? translate(
						text({
							en: "The text model is preparing a response…",
							hi: "टेक्स्ट मॉडल जवाब तैयार कर रहा है…",
						}),
					)
				: translate(
						text({
							en: "Speak naturally and hear the answer aloud",
							hi: "सहज रूप से बोलें और जवाब आवाज़ में सुनें",
						}),
					);
	const voicePhase = !voiceActive
		? "idle"
		: textVoiceRecording
			? "listening"
			: textVoiceSpeaking
				? "speaking"
				: "connecting";
	const voiceButtonLabel =
		voicePhase === "idle"
			? translate(
					text({
						en: "Start voice guide",
						hi: "आवाज़ मार्गदर्शक शुरू करें",
					}),
				)
			: voicePhase === "listening"
				? translate(text({ en: "Stop and send", hi: "रोककर भेजें" }))
				: voicePhase === "connecting"
					? translate(text({ en: "Preparing voice", hi: "आवाज़ तैयार हो रही है" }))
					: voicePhase === "speaking"
						? translate(
								text({ en: "UGAAP is speaking", hi: "UGAAP बोल रहा है" }),
							)
						: translate(text({ en: "Listening", hi: "सुन रहा है" }));
	const compactTranscript = useMemo(() => {
		const resultStates = new Map<string, ToolActivityState>();
		for (const message of chatState.messages) {
			for (const part of message.parts) {
				if (part.type === "tool-result") {
					resultStates.set(
						part.toolCallId,
						part.state === "error" ? "error" : "complete",
					);
				}
			}
		}

		const items: Array<CompactTranscriptItem> = [];
		let sequence = 0;
		for (const message of chatState.messages) {
			const timestamp = message.createdAt?.getTime() ?? sequence;
			if (message.role === "user") {
				const content = messageText(message.parts);
				if (content) {
					items.push({
						id: `${message.id}-message`,
						kind: "message",
						role: "user",
						content,
						timestamp,
					});
				}
			}
			if (message.role === "assistant") {
				for (const [partIndex, part] of message.parts.entries()) {
					if (part.type === "tool-call") {
						items.push({
							id: `${message.id}-${part.id}`,
							kind: "tool",
							content: toolActivityName(part.name, language),
							state: resultStates.get(part.id) ?? toolActivityState(part.state),
							timestamp: timestamp + partIndex / 100,
						});
					}
					if (part.type === "text" && part.content.trim()) {
						items.push({
							id: `${message.id}-text-${partIndex}`,
							kind: "message",
							role: "assistant",
							content: part.content,
							timestamp: timestamp + partIndex / 100,
						});
					}
				}
			}
			sequence += 1;
		}

		if (notice) {
			items.push({
				id: "assistant-notice",
				kind: "message",
				role: "assistant",
				content: notice,
				timestamp: Date.now() + 1,
			});
		}

		return items.sort((left, right) => left.timestamp - right.timestamp);
	}, [chatState.messages, language, notice]);
	const runningTools = compactTranscript.filter(
		(item) => item.kind === "tool" && item.state === "running",
	);
	const settledTranscript = compactTranscript.filter(
		(item) => item.kind !== "tool" || item.state !== "running",
	);
	const conversationStarted = chatState.messages.length > 0;
	const transcriptRevision = settledTranscript
		.map((item) => `${item.id}:${item.state ?? "message"}:${item.content}`)
		.join("|");

	useEffect(() => {
		const root = compactTranscriptRef.current;
		const viewport = root?.querySelector<HTMLElement>(
			'[data-slot="scroll-area-viewport"]',
		);
		if (!viewport) return;
		const updateFollowState = () => {
			compactTranscriptFollowsRef.current =
				viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 12;
		};
		viewport.addEventListener("scroll", updateFollowState, { passive: true });
		return () => viewport.removeEventListener("scroll", updateFollowState);
	}, []);

	useEffect(() => {
		if (!compactTranscriptFollowsRef.current || !transcriptRevision) return;
		const viewport = compactTranscriptRef.current?.querySelector<HTMLElement>(
			'[data-slot="scroll-area-viewport"]',
		);
		if (viewport) viewport.scrollTop = viewport.scrollHeight;
	}, [transcriptRevision]);

	const voiceWaveIsLive = textVoiceRecording;
	const voiceActionHint =
		voicePhase === "listening"
			? translate(
					text({
						en: "Tap stop when you are done. Your recording will be sent.",
						hi: "बोलने के बाद रोकें दबाएं। आपकी रिकॉर्डिंग भेजी जाएगी।",
					}),
				)
			: voicePhase === "speaking"
				? translate(
						text({
							en: "Playing the guide's reply aloud.",
							hi: "मार्गदर्शक का जवाब आवाज़ में सुनाया जा रहा है।",
						}),
					)
				: translate(
						text({
							en: "Setting up your microphone and speaker.",
							hi: "माइक्रोफोन और स्पीकर तैयार किए जा रहे हैं।",
						}),
					);
	async function confirmPendingSubmission() {
		if (!pendingSubmission) return;
		const result = await submitConfirmedGrievance(pendingSubmission.id, {
			allowCurrentTurn: true,
		});
		setNotice(result.reason);
	}
	return (
		<>
			<Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
				<SheetContent
					className="w-[min(100vw,30rem)] gap-0 border-l-2 border-[var(--action)] bg-[var(--paper)] p-0 sm:max-w-[30rem]"
					showCloseButton={false}
				>
					<SheetHeader className="border-b-2 border-[var(--line-strong)] px-5 py-4">
						<div className="flex items-start gap-3 pr-1">
							<div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--highlight)] text-[var(--ink)]">
								<Bot size={20} aria-hidden="true" />
							</div>
							<div className="min-w-0 flex-1">
								<SheetTitle className="text-lg text-[var(--ink)]">
									{translate(
										text({
											en: "Your grievance guide",
											hi: "आपका शिकायत मार्गदर्शक",
										}),
									)}
								</SheetTitle>
								<SheetDescription className="mt-1 leading-5 text-[var(--ink-muted)]">
									{translate(
										text({
											en: "Ask in your own words. You will review every form before it is sent.",
											hi: "अपने शब्दों में पूछें। भेजने से पहले आप हर फॉर्म जांचेंगे।",
										}),
									)}
								</SheetDescription>
							</div>
							{assistantBusy ? (
								<button
									type="button"
									onClick={() => void stopAssistant()}
									className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--danger)] px-3 text-xs font-bold text-[var(--danger)] hover:bg-red-50 focus-visible:outline-3 focus-visible:outline-[var(--highlight)]"
								>
									<Square size={13} fill="currentColor" aria-hidden="true" />
									{translate(text({ en: "Stop", hi: "रोकें" }))}
								</button>
							) : null}
							<SheetClose className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--blue-50)] hover:text-[var(--ink)] focus-visible:outline-3 focus-visible:outline-[var(--highlight)]">
								<X size={19} />
								<span className="sr-only">
									{translate(
										text({ en: "Close conversation", hi: "बातचीत बंद करें" }),
									)}
								</span>
							</SheetClose>
						</div>
					</SheetHeader>

					<ScrollArea className="min-h-0 flex-1" type="auto">
						<div aria-live="polite">
							{chatState.messages.length === 0 ? (
								<div className="px-5 py-8 text-sm leading-7 text-[var(--ink-muted)]">
									<p className="m-0 text-base font-bold text-[var(--ink)]">
										{translate(
											text({
												en: "Tell us what went wrong",
												hi: "बताएं कि क्या समस्या हुई",
											}),
										)}
									</p>
									<p className="mb-0 mt-2">
										{translate(
											text({
												en: "For example: My pension payment has stopped. Where should I complain?",
												hi: "उदाहरण: मेरी पेंशन रुक गई है। मैं शिकायत कहां करूं?",
											}),
										)}
									</p>
								</div>
							) : null}

							{chatState.messages.map((message) => {
								if (message.role === "user") {
									const content = messageText(message.parts);
									return content ? (
										<div
											key={message.id}
											className="border-b border-[var(--line)] bg-[var(--blue-50)] px-5 py-4 text-sm leading-7 text-[var(--ink)]"
										>
											<span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--action)]">
												{translate(text({ en: "You", hi: "आप" }))}
											</span>
											{content}
										</div>
									) : null;
								}
								const content = assistantReplyText(message.parts);
								const toolCalls = message.parts.filter(
									(part) => part.type === "tool-call",
								);
								const recommendation = toolCalls
									.flatMap((part) =>
										part.name === "search_grievance_catalogue" &&
										part.output?.status === "found"
											? part.output.results.slice(0, 1).map((result) => ({
													formId: result.id,
													authoritySlug: result.authoritySlug,
													authorityName: result.authorityName,
													formTitle: result.title,
												}))
											: [],
									)
									.at(0);
								return content || toolCalls.length ? (
									<div
										key={message.id}
										className="border-b border-[var(--line)] px-5 py-5 text-sm leading-7 text-[var(--ink-muted)]"
									>
										<span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--action)]">
											UGAAP
										</span>
										{toolCalls.map((part) => {
											const state = toolActivityState(part.state);
											return (
												<div
													key={part.id}
													className={`flex items-center gap-2 py-1 text-xs font-semibold ${state === "error" ? "text-[var(--danger)]" : "text-[var(--action)]"}`}
												>
													{state === "running" ? (
														<LoaderCircle className="animate-spin" size={14} />
													) : state === "error" ? (
														<TriangleAlert size={14} />
													) : (
														<Check size={14} />
													)}
													<span>{toolActivityName(part.name, language)}</span>
												</div>
											);
										})}
										{content ? (
											<p className="m-0 whitespace-pre-wrap">{content}</p>
										) : null}
										{recommendation ? (
											<div className="mt-4 border-l-4 border-[var(--highlight)] pl-4">
												<p className="m-0 text-xs font-bold text-[var(--action)]">
													{recommendation.authorityName}
												</p>
												<p className="mb-3 mt-1 font-bold text-[var(--ink)]">
													{recommendation.formTitle}
												</p>
												<button
													type="button"
													onClick={() =>
														void openRecommendation(recommendation)
													}
													className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[var(--action)] hover:text-[var(--action-hover)] focus-visible:outline-3 focus-visible:outline-[var(--highlight)]"
												>
													{session?.user
														? translate(
																text({
																	en: "Open this form",
																	hi: "यह फॉर्म खोलें",
																}),
															)
														: translate(
																text({
																	en: "Sign in to continue",
																	hi: "आगे बढ़ने के लिए साइन इन करें",
																}),
															)}
													{session?.user ? (
														<ArrowRight size={16} />
													) : (
														<LogIn size={16} />
													)}
												</button>
											</div>
										) : null}
									</div>
								) : null;
							})}

							{chatState.isLoading ? (
								<div className="flex items-center gap-2 px-5 py-5 text-sm text-[var(--ink-muted)]">
									<LoaderCircle
										className="animate-spin text-[var(--action)]"
										size={18}
									/>
									{translate(
										text({
											en: "Checking the available grievance types...",
											hi: "उपलब्ध शिकायत प्रकार देखे जा रहे हैं...",
										}),
									)}
								</div>
							) : null}
						</div>
					</ScrollArea>

					{notice || canUndo ? (
						<div className="flex items-center justify-between gap-3 border-t-2 border-[var(--line-strong)] bg-[var(--blue-50)] px-5 py-3 text-xs leading-5 text-[var(--ink)]">
							<span>{notice}</span>
							{canUndo ? (
								<button
									type="button"
									onClick={undoLastFill}
									className="inline-flex min-h-10 shrink-0 items-center gap-1.5 font-bold text-[var(--action)]"
								>
									<Undo2 size={15} aria-hidden="true" />
									{translate(text({ en: "Undo", hi: "वापस करें" }))}
								</button>
							) : null}
						</div>
					) : null}
				</SheetContent>
			</Sheet>

			<form
				onSubmit={(event) => void submit(event)}
				className="assistant-dock px-3 py-2 sm:px-4"
			>
				{conversationStarted ? (
					<ScrollArea
						ref={compactTranscriptRef}
						type="hover"
						className="assistant-response mb-2 h-16 px-1 text-sm text-[var(--ink-muted)]"
					>
						<div className="py-0.5" aria-live="polite">
							{settledTranscript.length ? (
								settledTranscript.map((item) =>
									item.kind === "tool" ? (
										<p
											key={item.id}
											className={`m-0 flex min-h-5 items-start gap-1.5 text-xs leading-5 ${item.state === "error" ? "text-[var(--danger)]" : "text-[var(--action)]"}`}
										>
											{item.state === "error" ? (
												<TriangleAlert className="mt-0.5 shrink-0" size={13} />
											) : (
												<Check className="mt-0.5 shrink-0" size={13} />
											)}
											<span>{item.content}</span>
										</p>
									) : (
										<p key={item.id} className="m-0 min-h-5 leading-5">
											<span className="mr-1 font-extrabold text-[var(--action)]">
												{item.role === "user"
													? translate(text({ en: "You", hi: "आप" }))
													: "UGAAP"}
											</span>
											{item.content}
										</p>
									),
								)
							) : (
								<p className="m-0 leading-5 text-[var(--ink-muted)]">
									{translate(
										text({
											en: "Listening for your message...",
											hi: "आपका संदेश सुन रहा है...",
										}),
									)}
								</p>
							)}
						</div>
					</ScrollArea>
				) : (
					<div
						className="assistant-response mb-2 px-1 text-sm leading-5 text-[var(--ink-muted)]"
						aria-live="polite"
					>
						{translate(
							text({
								en: "I can help you file a grievance, navigate UGAAP, and guide you through each step.",
								hi: "मैं शिकायत दर्ज करने, UGAAP वेबसाइट पर जाने और हर चरण में आपका मार्गदर्शन करने में मदद कर सकता हूँ।",
							}),
						)}
					</div>
				)}

				{runningTools.length ? (
					<div
						className="mb-2 flex min-h-7 items-center gap-2 px-1 text-xs font-bold text-[var(--action)]"
						aria-live="polite"
					>
						<LoaderCircle className="shrink-0 animate-spin" size={14} />
						<Wrench className="shrink-0" size={13} aria-hidden="true" />
						<span className="truncate">
							{runningTools.map((tool) => tool.content).join(", ")}
						</span>
					</div>
				) : null}

				{pendingSubmission ? (
					<div className="mb-2 flex flex-wrap items-center justify-between gap-2 bg-[var(--blue-50)] px-2 py-1.5 text-xs">
						<span className="font-semibold text-[var(--ink)]">
							{translate(
								text({
									en: `Ready to submit ${pendingSubmission.formTitle}. Confirm after checking the review.`,
									hi: `${pendingSubmission.formTitle} जमा करने के लिए तैयार है। समीक्षा जाँचकर पुष्टि करें।`,
								}),
							)}
						</span>
						<span className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => void confirmPendingSubmission()}
								className="min-h-9 rounded-md bg-[var(--action)] px-3 font-bold text-white"
							>
								{translate(
									text({
										en: "Confirm and submit",
										hi: "पुष्टि करके जमा करें",
									}),
								)}
							</button>
							<button
								type="button"
								onClick={cancelPendingSubmission}
								className="min-h-9 px-2 font-bold text-[var(--ink-muted)] underline"
							>
								{translate(text({ en: "Cancel", hi: "रद्द करें" }))}
							</button>
						</span>
					</div>
				) : null}

				<div className="flex items-center gap-2">
					{voiceActive ? (
						<div className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] px-2 text-[var(--ink)]">
							<button
								type="button"
								onClick={() => void cancelVoiceInput()}
								className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--ink-muted)] hover:bg-[var(--blue-50)] hover:text-[var(--danger)] focus-visible:outline-2 focus-visible:outline-[var(--highlight)]"
								aria-label={translate(
									text({ en: "Cancel recording", hi: "रिकॉर्डिंग रद्द करें" }),
								)}
							>
								<Trash2 size={18} aria-hidden="true" />
							</button>
							<span
								className={`size-2 shrink-0 rounded-full ${voicePhase === "listening" ? "animate-pulse bg-[var(--danger)]" : "bg-[var(--line-strong)]"}`}
								aria-hidden="true"
							/>
							<span className="shrink-0 text-sm font-semibold tabular-nums">
								{elapsedVoiceTime(voiceElapsedSeconds)}
							</span>
							<VoiceWaveform
								phase={voicePhase === "idle" ? "connecting" : voicePhase}
								live={voiceWaveIsLive}
								waveformRef={textVoiceWaveformRef}
							/>
							<span className="sr-only" aria-live="polite">
								{voiceStatus}. {voiceActionHint}
							</span>
							<button
								type="button"
								onClick={() =>
									void (textVoiceRecording
										? finishTextVoiceRecording()
										: stopVoice())
								}
								className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--highlight)] text-[var(--ink)] hover:bg-[var(--highlight-soft)] focus-visible:outline-3 focus-visible:outline-[var(--action)]"
								aria-label={voiceButtonLabel}
							>
								{textVoiceRecording ? (
									<Send size={19} aria-hidden="true" />
								) : voicePhase === "connecting" ? (
									<LoaderCircle
										className="animate-spin"
										size={18}
										aria-hidden="true"
									/>
								) : (
									<Square size={15} fill="currentColor" aria-hidden="true" />
								)}
							</button>
						</div>
					) : (
						<>
							<button
								type="button"
								onClick={() => void toggleVoice()}
								aria-pressed="false"
								aria-label={voiceButtonLabel}
								className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg bg-[var(--highlight)] px-3 text-sm font-extrabold text-[var(--ink)] transition-colors hover:bg-[var(--highlight-soft)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--highlight)]"
							>
								<Mic size={20} aria-hidden="true" />
								<span className="hidden sm:inline">{voiceButtonLabel}</span>
							</button>
							<label className="sr-only" htmlFor="ugaap-command-input">
								{translate(
									text({
										en: "Describe what happened",
										hi: "बताएं कि क्या हुआ",
									}),
								)}
							</label>
							<textarea
								id="ugaap-command-input"
								rows={1}
								value={input}
								onChange={(event) => setInput(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey) {
										event.preventDefault();
										void submit();
									}
								}}
								placeholder={translate(
									text({
										en: "Tell us what happened...",
										hi: "बताएं कि क्या हुआ...",
									}),
								)}
								className="min-h-12 min-w-0 flex-1 resize-none rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2.5 text-base leading-7 text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:border-[var(--action)] focus:ring-3 focus:ring-[var(--highlight-soft)]"
							/>
							{chatState.isLoading ? (
								<button
									type="button"
									onClick={() => void stopAssistant()}
									className="grid size-12 shrink-0 place-items-center rounded-lg border border-[var(--danger)] text-[var(--danger)] hover:bg-red-50"
									aria-label={translate(
										text({ en: "Stop response", hi: "जवाब रोकें" }),
									)}
								>
									<Square size={15} fill="currentColor" aria-hidden="true" />
								</button>
							) : (
								<button
									type="submit"
									disabled={!input.trim()}
									className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--action)] text-white hover:bg-[var(--action-hover)] disabled:cursor-not-allowed disabled:opacity-35"
									aria-label={translate(
										text({ en: "Send message", hi: "संदेश भेजें" }),
									)}
								>
									<Send size={19} aria-hidden="true" />
								</button>
							)}
						</>
					)}

					<button
						type="button"
						onClick={() => setHistoryOpen(true)}
						className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg border border-[var(--line-strong)] px-3 text-sm font-extrabold text-[var(--ink)] hover:border-[var(--action)] hover:bg-[var(--blue-50)] focus-visible:outline-3 focus-visible:outline-[var(--highlight)]"
					>
						<MessageSquareText size={19} aria-hidden="true" />
						<span className="hidden md:inline">
							{translate(text({ en: "History", hi: "बातचीत" }))}
						</span>
					</button>
				</div>

				<div className="mt-2 inline-flex overflow-hidden rounded-md border border-[var(--line-strong)] text-xs font-semibold text-[var(--ink-muted)]">
					{(
						[
							{
								id: "text",
								label: text({ en: "Text model", hi: "टेक्स्ट मॉडल" }),
							},
							{
								id: "local",
								label: text({ en: "Local", hi: "लोकल" }),
							},
						] as const
					).map((option) => {
						const selected = assistantMode === option.id;
						const disabled = option.id === "local" || voiceActive;
						return (
							<button
								key={option.id}
								type="button"
								aria-pressed={selected}
								disabled={disabled}
								onClick={() => {
									if (option.id === "text") setAssistantMode(option.id);
								}}
								className={`min-h-8 border-r border-[var(--line-strong)] px-2.5 last:border-r-0 transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--highlight)] ${selected ? "bg-[var(--blue-50)] text-[var(--action)]" : "hover:bg-[var(--blue-50)] hover:text-[var(--ink)]"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
							>
								<span>{translate(option.label)}</span>
							</button>
						);
					})}
				</div>

				<p
					hidden
					className="m-0 mt-1 min-h-4 truncate px-1 text-left text-[11px] leading-4 text-[var(--ink-muted)]"
					aria-live="polite"
				>
					{voiceActive
						? voiceStatus
						: latestDockReply
							? latestDockReply
							: translate(
									text({
										en: "Nothing is submitted until you review it.",
										hi: "आपकी जांच से पहले कुछ भी जमा नहीं होगा।",
									}),
								)}
				</p>
			</form>
		</>
	);
}
