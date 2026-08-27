import type { RealtimeToken } from "@tanstack/ai";
import { clientTools } from "@tanstack/ai-client";
import { geminiRealtime } from "@tanstack/ai-gemini";
import {
	fetchServerSentEvents,
	useAudioRecorder,
	useChat,
	useRealtimeChat,
} from "@tanstack/ai-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	ArrowRight,
	Bot,
	LoaderCircle,
	LogIn,
	MessageSquareText,
	Mic,
	Send,
	Square,
	Undo2,
	X,
} from "lucide-react";
import {
	type FormEvent,
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
import {
	assistantTranscriptionSchema,
	assistantTurnSchema,
} from "#/features/assistant/schema";
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

type AssistantMode = "realtime" | "text" | "local";

function messageText(
	parts: ReadonlyArray<{ type: string; content?: unknown }>,
) {
	return parts
		.flatMap((part) =>
			part.type === "text" && typeof part.content === "string"
				? [part.content]
				: [],
		)
		.join(" ");
}

function canonicalFormDestination(authoritySlug: string, formId: string) {
	const search = new URLSearchParams({ form: formId, review: "false" });
	return `/services/${encodeURIComponent(authoritySlug)}?${search.toString()}`;
}

const geminiRealtimeProviderOptions = {
	thinkingConfig: { thinkingLevel: "high" },
} as const;

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
	const [lastVoiceTranscript, setLastVoiceTranscript] = useState<string | null>(
		null,
	);
	const [voiceRequested, setVoiceRequested] = useState(false);
	const [assistantMode, setAssistantMode] = useState<AssistantMode>("realtime");
	const [pageContent, setPageContent] = useState("");
	const finishTextRecordingRef = useRef<() => Promise<void>>(
		async () => undefined,
	);
	const textVoiceStopTimerRef = useRef(0);
	const textVoiceFinishingRef = useRef(false);
	const speakFallbackRef = useRef(false);
	const textVoiceBaselineRef = useRef<unknown>(null);
	const messageLanguageRef = useRef<"en" | "hi" | null>(null);
	const voiceRequestedRef = useRef(false);
	const liveWasConnectedRef = useRef(false);
	const liveCleanupInFlightRef = useRef(false);
	const lastRealtimeUserTurnRef = useRef<string | null>(null);
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
		outputSchema: assistantTurnSchema,
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

	useEffect(() => {
		const final = chatState.final;
		if (
			!final ||
			!speakFallbackRef.current ||
			!textVoicePending ||
			final === textVoiceBaselineRef.current
		)
			return;

		let finished = false;
		let disposed = false;
		const finishVoiceTurn = () => {
			if (finished || disposed) return;
			finished = true;
			speakFallbackRef.current = false;
			setTextVoicePending(false);
			setTextVoiceSpeaking(false);
			voiceRequestedRef.current = false;
			setVoiceRequested(false);
		};
		const language = /[\u0900-\u097f]/.test(final.message) ? "hi" : "en";
		const speakWithBrowser = () => {
			if (
				disposed ||
				typeof window === "undefined" ||
				!("speechSynthesis" in window)
			) {
				finishVoiceTurn();
				return;
			}
			window.speechSynthesis.cancel();
			const utterance = new SpeechSynthesisUtterance(final.message);
			const voice = selectSpeechVoice(
				window.speechSynthesis.getVoices(),
				language,
			);
			utterance.lang = voice?.lang ?? (language === "hi" ? "hi-IN" : "en-IN");
			if (voice) utterance.voice = voice;
			utterance.rate = language === "hi" ? 0.94 : 0.97;
			utterance.pitch = 1;
			utterance.onstart = () => setTextVoiceSpeaking(true);
			utterance.onend = finishVoiceTurn;
			utterance.onerror = finishVoiceTurn;
			try {
				window.speechSynthesis.speak(utterance);
			} catch {
				finishVoiceTurn();
			}
		};
		setNotice(null);
		speakWithBrowser();
		return () => {
			disposed = true;
			if (typeof window !== "undefined" && "speechSynthesis" in window)
				window.speechSynthesis.cancel();
		};
	}, [chatState.final, textVoicePending]);

	const currentCatalogueForm = currentForm?.form ?? null;
	const visibleFormDescription = useMemo(
		() =>
			currentCatalogueForm
				? {
						id: currentCatalogueForm.id,
						title: currentCatalogueForm.title,
						heading: currentCatalogueForm.heading,
						categoryPath: currentCatalogueForm.categoryPath,
						stage: currentForm?.stage ?? "edit",
						fields: currentCatalogueForm.fields
							.filter((field) => field.kind !== "file")
							.map((field) => ({
								id: field.id,
								label: field.label,
								kind: field.kind,
								required: field.required,
								placeholder: field.placeholder,
								maximumLength: field.maximumLength,
								pattern: field.pattern,
								options: field.options,
								value: currentForm?.values[field.id] ?? "",
								error: currentForm?.errors[field.id] ?? null,
							})),
					}
				: null,
		[currentCatalogueForm, currentForm],
	);

	const voiceInstructions = useMemo(
		() =>
			[
				"You are UGAAP's voice website guide. Understand the current UGAAP page and operate it through tools when asked.",
				`Detect the language of every citizen utterance from its grammar and majority language. Reply in English when they speak English. Reply in simple natural Hindi when they speak Hindi or Hinglish. Indian names and official or legal terms such as Aadhaar, benami, pension, PAN, and ministry inside an English utterance do not make it Hindi. Do not use the website's ${language === "hi" ? "Hindi" : "English"} interface setting to choose the reply language.`,
				"Use VISIBLE_FORM before catalogue search. If a form is visible, fill, review, or submit it directly and do not search for it or navigate away.",
				"Search only when a grievance route must be discovered. Use authority and category tools for directory questions and workspace tools for status questions.",
				"Never invent a page, form, status, government action, or successful tool result. Keep replies short and conversational.",
				"Map natural answers to visible form fields. Never ask for an internal field id, fill file fields, or fill values the citizen did not supply.",
				"Submission requires a separate confirmation after review. Request confirmation first and submit only after a later explicit yes.",
				visibleFormDescription
					? `VISIBLE_FORM: ${JSON.stringify(visibleFormDescription)}`
					: "No grievance form is visible.",
				`PAGE_CONTENT: ${pageContent || "No readable page content was captured."}`,
				`CURRENT_ROUTE: ${JSON.stringify(currentRoute)}`,
				`SITE_ROUTES: ${JSON.stringify(assistantRouteSummary())}`,
			].join("\n"),
		[currentRoute, language, pageContent, visibleFormDescription],
	);

	const realtime = useRealtimeChat({
		getToken: async () => {
			const response = await fetch("/api/ai/realtime-token", {
				method: "POST",
				credentials: "same-origin",
			});
			if (!response.ok) throw new Error("Gemini Live is unavailable.");
			return (await response.json()) as RealtimeToken;
		},
		adapter: useMemo(
			() => geminiRealtime({ model: "gemini-3.1-flash-live-preview" }),
			[],
		),
		tools: assistantTools,
		autoCapture: true,
		autoPlayback: true,
		instructions: voiceInstructions,
		voice: "Charon",
		vadMode: "server",
		outputModalities: ["audio", "text"],
		onConnect: () =>
			setNotice(
				translate(
					text({
						en: "Voice is on. Speak naturally; UGAAP will answer aloud.",
						hi: "आवाज़ चालू है। स्वाभाविक रूप से बोलें; UGAAP आवाज़ में जवाब देगा।",
					}),
				),
			),
		onError: (error) =>
			setNotice(
				translate(
					text({
						en: `Gemini Live could not start: ${error.message}`,
						hi: `Gemini Live शुरू नहीं हो सका: ${error.message}`,
					}),
				),
			),
	});

	useEffect(() => {
		const latestUser = [...realtime.messages]
			.reverse()
			.find((message) => message.role === "user");
		if (!latestUser || lastRealtimeUserTurnRef.current === latestUser.id)
			return;
		lastRealtimeUserTurnRef.current = latestUser.id;
		beginUserTurn();
	}, [beginUserTurn, realtime.messages]);

	useEffect(() => {
		realtime.updateSession({
			instructions: voiceInstructions,
			voice: "Charon",
			vadMode: "server",
			outputModalities: ["audio", "text"],
			providerOptions: geminiRealtimeProviderOptions,
		});
	}, [realtime.updateSession, voiceInstructions]);

	const setVoiceEnabled = useCallback((enabled: boolean) => {
		voiceRequestedRef.current = enabled;
		setVoiceRequested(enabled);
	}, []);

	const clearTextVoiceStopTimer = useCallback(() => {
		if (!textVoiceStopTimerRef.current) return;
		window.clearTimeout(textVoiceStopTimerRef.current);
		textVoiceStopTimerRef.current = 0;
	}, []);

	async function submit(event?: FormEvent) {
		event?.preventDefault();
		const message = input.trim();
		if (!message || chatState.isLoading) return;
		setNotice(null);
		setLastVoiceTranscript(null);
		beginUserTurn();
		setInput("");
		messageLanguageRef.current = null;
		await chatState.sendMessage(message);
	}

	const finishTextVoiceRecording = useCallback(async () => {
		if (!textVoiceRecording || textVoiceFinishingRef.current) return;
		textVoiceFinishingRef.current = true;
		clearTextVoiceStopTimer();
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

			setLastVoiceTranscript(transcript);
			beginUserTurn();
			speakFallbackRef.current = true;
			textVoiceBaselineRef.current = chatState.final;
			setNotice(
				translate(
					text({
						en: "Transcript ready. Preparing a response…",
						hi: "लिखा हुआ संदेश तैयार है। जवाब तैयार हो रहा है…",
					}),
				),
			);
			messageLanguageRef.current = transcription.data.language;
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
			setNotice(
				translate(
					permissionDenied
						? text({
								en: "Microphone access was blocked. Allow microphone access, then try again.",
								hi: "माइक्रोफ़ोन की अनुमति नहीं मिली। अनुमति देकर फिर कोशिश करें।",
							})
						: text({
								en: "The recording could not be processed. Try again or type your message.",
								hi: "रिकॉर्डिंग तैयार नहीं हो सकी। दोबारा कोशिश करें या संदेश टाइप करें।",
							}),
				),
			);
		} finally {
			textVoiceFinishingRef.current = false;
		}
	}, [
		beginUserTurn,
		chatState.final,
		chatState.sendMessage,
		clearTextVoiceStopTimer,
		setVoiceEnabled,
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
		setLastVoiceTranscript(null);
		try {
			await startTextRecorder();
			if (!voiceRequestedRef.current) {
				cancelTextRecorder();
				return;
			}
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
		textVoiceSupported,
		translate,
	]);

	async function stopVoice() {
		setVoiceEnabled(false);
		clearTextVoiceStopTimer();
		cancelTextRecorder();
		speakFallbackRef.current = false;
		setTextVoicePending(false);
		setTextVoiceSpeaking(false);
		realtime.interrupt();
		realtime.stopListening();
		await realtime.disconnect().catch(() => undefined);
		if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.cancel();
		}
	}

	async function stopAssistant() {
		chatState.stop();
		if (
			voiceRequestedRef.current ||
			textVoiceRecording ||
			realtime.status !== "idle"
		) {
			await stopVoice();
		} else if (typeof window !== "undefined" && "speechSynthesis" in window) {
			window.speechSynthesis.cancel();
		}
		setNotice(translate(text({ en: "Stopped.", hi: "रोक दिया गया।" })));
	}

	async function toggleVoice() {
		setNotice(null);
		if (voiceRequestedRef.current) {
			if (assistantMode === "text" && textVoiceRecording) {
				await finishTextVoiceRecording();
				return;
			}
			await stopVoice();
			return;
		}
		setVoiceEnabled(true);
		if (assistantMode === "text") {
			realtime.interrupt();
			realtime.stopListening();
			await realtime.disconnect().catch(() => undefined);
			if (voiceRequestedRef.current) await startTextVoiceRecording();
			return;
		}
		try {
			realtime.updateSession({
				instructions: voiceInstructions,
				voice: "Charon",
				vadMode: "server",
				outputModalities: ["audio", "text"],
				providerOptions: geminiRealtimeProviderOptions,
			});
			await realtime.connect();
		} catch {
			await realtime.disconnect().catch(() => undefined);
			if (voiceRequestedRef.current) {
				setAssistantMode("text");
				await startTextVoiceRecording();
			}
		}
	}

	useEffect(() => {
		if (realtime.status === "connected") {
			liveWasConnectedRef.current = true;
			return;
		}
		if (
			(realtime.status !== "idle" && realtime.status !== "error") ||
			!liveWasConnectedRef.current ||
			!voiceRequestedRef.current ||
			liveCleanupInFlightRef.current
		)
			return;

		// Gemini can close its socket while the audio stream remains alive. Force a
		// full teardown before falling back so the browser never keeps a leaked mic.
		liveWasConnectedRef.current = false;
		liveCleanupInFlightRef.current = true;
		void realtime
			.disconnect()
			.catch(() => undefined)
			.finally(() => {
				liveCleanupInFlightRef.current = false;
				if (!voiceRequestedRef.current) return;
				setNotice(
					translate(
						text({
							en: "The live voice session ended. Record this message for the text model instead.",
							hi: "लाइव वॉइस सत्र बंद हो गया। यह संदेश टेक्स्ट मॉडल के लिए रिकॉर्ड करें।",
						}),
					),
				);
				setAssistantMode("text");
				void startTextVoiceRecording();
			});
	}, [
		realtime.disconnect,
		realtime.status,
		startTextVoiceRecording,
		translate,
	]);

	useEffect(
		() => () => {
			voiceRequestedRef.current = false;
			if (textVoiceStopTimerRef.current)
				window.clearTimeout(textVoiceStopTimerRef.current);
			cancelTextRecorder();
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		},
		[cancelTextRecorder],
	);

	async function openRecommendation(turn: typeof chatState.final) {
		if (!turn?.formId || !turn.authoritySlug) return;
		const destination = canonicalFormDestination(
			turn.authoritySlug,
			turn.formId,
		);
		if (!session?.user) {
			await navigate({ to: "/login", search: { redirect: destination } });
			return;
		}
		await navigate({
			to: "/services/$authoritySlug",
			params: { authoritySlug: turn.authoritySlug },
			search: { form: turn.formId, review: false, draft: undefined },
		});
	}

	const voiceActive = voiceRequested;
	const assistantBusy = voiceActive || chatState.isLoading;
	const lastRealtimeMessage = realtime.messages.at(-1);
	const lastRealtimeTranscript = lastRealtimeMessage?.parts
		.flatMap((part) =>
			part.type === "text"
				? [part.content]
				: part.type === "audio" && part.transcript
					? [part.transcript]
					: [],
		)
		.join(" ");
	const latestVoiceReply =
		voiceActive && assistantMode === "realtime"
			? (realtime.pendingUserTranscript ??
				realtime.pendingAssistantTranscript ??
				lastRealtimeTranscript)
			: null;
	const latestDockReply =
		latestVoiceReply ?? chatState.partial.message ?? chatState.final?.message;
	const voiceStatus =
		assistantMode === "text"
			? textVoiceRecording
				? translate(
						text({
							en: "Recording now. Tap voice to stop and send.",
							hi: "रिकॉर्डिंग चालू है। रोककर भेजने के लिए वॉइस दबाएँ।",
						}),
					)
				: textVoiceSpeaking
					? translate(
							text({ en: "UGAAP is speaking…", hi: "UGAAP बोल रहा है…" }),
						)
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
							)
			: textVoiceRecording
				? translate(text({ en: "Listening now…", hi: "अभी सुन रहे हैं…" }))
				: realtime.status === "connected"
					? realtime.mode === "speaking"
						? translate(
								text({ en: "UGAAP is speaking…", hi: "UGAAP बोल रहा है…" }),
							)
						: translate(
								text({
									en: "Listening—speak naturally",
									hi: "सुन रहे हैं—सहज रूप से बोलें",
								}),
							)
					: voiceActive
						? translate(
								text({
									en: "Connecting realtime voice…",
									hi: "रीयलटाइम आवाज़ जुड़ रही है…",
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
		: assistantMode === "text"
			? textVoiceRecording
				? "listening"
				: textVoiceSpeaking
					? "speaking"
					: "connecting"
			: textVoiceRecording ||
					(realtime.status === "connected" && realtime.mode !== "speaking")
				? "listening"
				: realtime.status === "connected" && realtime.mode === "speaking"
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
			: voicePhase === "listening" && assistantMode === "text"
				? translate(text({ en: "Stop and send", hi: "रोककर भेजें" }))
				: voicePhase === "connecting"
					? translate(text({ en: "Connecting voice", hi: "आवाज़ जुड़ रही है" }))
					: voicePhase === "speaking"
						? translate(
								text({ en: "UGAAP is speaking", hi: "UGAAP बोल रहा है" }),
							)
						: translate(text({ en: "Listening", hi: "सुन रहा है" }));
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
							{chatState.messages.length === 0 &&
							realtime.messages.length === 0 ? (
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
								const structured = message.parts.find(
									(part) => part.type === "structured-output",
								);
								const turn = structured?.data ?? structured?.partial;
								return turn?.message ? (
									<div
										key={message.id}
										className="border-b border-[var(--line)] px-5 py-5 text-sm leading-7 text-[var(--ink-muted)]"
									>
										<span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--action)]">
											UGAAP
										</span>
										<p className="m-0">{turn.message}</p>
										{turn.formId && turn.authoritySlug ? (
											<div className="mt-4 border-l-4 border-[var(--highlight)] pl-4">
												<p className="m-0 text-xs font-bold text-[var(--action)]">
													{turn.authorityName}
												</p>
												<p className="mb-3 mt-1 font-bold text-[var(--ink)]">
													{turn.formTitle}
												</p>
												<button
													type="button"
													onClick={() =>
														void openRecommendation(structured?.data ?? null)
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

							{realtime.messages.map((message) => {
								const content = message.parts
									.flatMap((part) =>
										part.type === "text"
											? [part.content]
											: part.type === "audio" && part.transcript
												? [part.transcript]
												: [],
									)
									.join(" ");
								return content ? (
									<div
										key={message.id}
										className={`border-b border-[var(--line)] px-5 py-4 text-sm leading-7 ${message.role === "user" ? "bg-[var(--blue-50)] text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}
									>
										<span className="mb-1 block text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--action)]">
											{message.role === "user"
												? translate(text({ en: "You", hi: "आप" }))
												: "UGAAP"}
										</span>
										{content}
									</div>
								) : null;
							})}

							{realtime.pendingUserTranscript ||
							realtime.pendingAssistantTranscript ? (
								<div className="border-b border-[var(--line)] px-5 py-4 text-sm italic text-[var(--ink-muted)]">
									{realtime.pendingUserTranscript ??
										realtime.pendingAssistantTranscript}
								</div>
							) : null}
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
				<div
					className="assistant-response mb-2 border-b border-[var(--line)] px-1 pb-2 text-sm leading-5 text-[var(--ink-muted)]"
					aria-live="polite"
				>
					{pendingSubmission ? (
						<div className="flex flex-wrap items-center justify-between gap-2">
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
									className="min-h-9 rounded-md bg-[var(--action)] px-3 text-xs font-bold text-white"
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
									className="min-h-9 px-2 text-xs font-bold text-[var(--ink-muted)] underline"
								>
									{translate(text({ en: "Cancel", hi: "रद्द करें" }))}
								</button>
							</span>
						</div>
					) : (
						<span className="block truncate">
							{voiceActive
								? voiceStatus
								: latestDockReply ||
									notice ||
									translate(
										text({
											en: "I can help you file a grievance, navigate UGAAP, and guide you through each step.",
											hi: "मैं शिकायत दर्ज करने, UGAAP वेबसाइट पर जाने और हर चरण में आपका मार्गदर्शन करने में मदद कर सकता हूँ।",
										}),
									)}
						</span>
					)}
				</div>
				{lastVoiceTranscript ? (
					<p
						className="m-0 mb-2 border-b border-[var(--line)] px-1 pb-2 text-sm leading-5 text-[var(--ink)]"
						aria-live="polite"
					>
						<span className="mr-1 font-extrabold text-[var(--action)]">
							{translate(text({ en: "You said:", hi: "आपने कहा:" }))}
						</span>
						{lastVoiceTranscript}
					</p>
				) : null}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => void toggleVoice()}
						aria-pressed={voiceActive}
						aria-label={voiceButtonLabel}
						className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-extrabold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--highlight)] ${voiceActive ? "bg-[var(--action)] text-white" : "bg-[var(--highlight)] text-[var(--ink)] hover:bg-[var(--highlight-soft)]"}`}
					>
						{voicePhase === "idle" ? (
							<Mic size={20} aria-hidden="true" />
						) : voicePhase === "connecting" ? (
							<LoaderCircle
								className="animate-spin"
								size={19}
								aria-hidden="true"
							/>
						) : assistantMode === "text" && textVoiceRecording ? (
							<Square size={17} fill="currentColor" aria-hidden="true" />
						) : (
							<span
								className="flex h-7 items-center gap-0.5"
								aria-hidden="true"
							>
								<span className="voice-bar w-1 rounded-full bg-current" />
								<span className="voice-bar w-1 rounded-full bg-current [animation-delay:140ms]" />
								<span className="voice-bar w-1 rounded-full bg-current [animation-delay:280ms]" />
							</span>
						)}
						<span className="hidden sm:inline">{voiceButtonLabel}</span>
					</button>

					<label className="sr-only" htmlFor="ugaap-command-input">
						{translate(
							text({ en: "Describe what happened", hi: "बताएं कि क्या हुआ" }),
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
							text({ en: "Tell us what happened...", hi: "बताएं कि क्या हुआ..." }),
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
							aria-label={translate(text({ en: "Send message", hi: "संदेश भेजें" }))}
						>
							<Send size={19} aria-hidden="true" />
						</button>
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
								id: "realtime",
								label: text({ en: "Realtime", hi: "रीयलटाइम" }),
							},
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
									if (option.id === "realtime" || option.id === "text")
										setAssistantMode(option.id);
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
