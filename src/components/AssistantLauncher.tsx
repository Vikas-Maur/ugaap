import type { RealtimeToken } from "@tanstack/ai";
import { clientTools } from "@tanstack/ai-client";
import { geminiRealtime } from "@tanstack/ai-gemini";
import {
	fetchServerSentEvents,
	useChat,
	useRealtimeChat,
} from "@tanstack/ai-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
	ArrowRight,
	Bot,
	Keyboard,
	LoaderCircle,
	LogIn,
	MessageSquareText,
	Mic,
	MicOff,
	Send,
	Square,
	Undo2,
	Volume2,
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

import { useAssistantContext } from "#/features/assistant/context";
import {
	type AssistantTurn,
	assistantTurnSchema,
} from "#/features/assistant/schema";
import {
	fillVisibleFormDef,
	openGrievanceFormDef,
	searchGrievanceCatalogueDef,
} from "#/features/assistant/tools";
import {
	findForm,
	loadAuthorityChunk,
	searchCatalogue,
} from "#/features/catalogue/client";
import { text, useI18n } from "#/features/i18n/i18n";
import { authClient } from "#/lib/auth-client";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "./ui/sheet";

type BrowserRecognition = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	start: () => void;
	stop: () => void;
	onresult:
		| ((event: {
				results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
		  }) => void)
		| null;
	onerror: (() => void) | null;
	onend: (() => void) | null;
};

type BrowserRecognitionConstructor = new () => BrowserRecognition;

function browserRecognitionConstructor() {
	if (typeof window === "undefined") return undefined;
	const voiceWindow = window as Window & {
		SpeechRecognition?: BrowserRecognitionConstructor;
		webkitSpeechRecognition?: BrowserRecognitionConstructor;
	};
	return voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
}

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

function readablePageContent() {
	if (typeof document === "undefined") return "";
	const root = document.querySelector<HTMLElement>(
		"[data-assistant-page-content]",
	);
	if (!root) return "";
	const seen = new Set<string>();
	const lines: string[] = [];
	for (const element of root.querySelectorAll<HTMLElement>(
		"h1, h2, h3, p, label, legend, th, td, li, a, button, [role='alert'], [role='status']",
	)) {
		if (element.closest("[aria-hidden='true']")) continue;
		const content = element.innerText.replace(/\s+/g, " ").trim();
		if (!content || seen.has(content)) continue;
		seen.add(content);
		lines.push(content);
		if (lines.join("\n").length >= 8_000) break;
	}
	return lines.join("\n").slice(0, 8_000);
}

export function AssistantLauncher() {
	const { language, text: translate } = useI18n();
	const { data: session } = authClient.useSession();
	const navigate = useNavigate();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const { currentForm, applyFields, undoLastFill, canUndo } =
		useAssistantContext();
	const [input, setInput] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [browserListening, setBrowserListening] = useState(false);
	const [voiceRequested, setVoiceRequested] = useState(false);
	const [pageContent, setPageContent] = useState("");
	const inputRef = useRef<HTMLTextAreaElement | null>(null);
	const recognitionRef = useRef<BrowserRecognition | null>(null);
	const speakFallbackRef = useRef(false);
	const voiceRequestedRef = useRef(false);
	const liveWasConnectedRef = useRef(false);
	const liveCleanupInFlightRef = useRef(false);
	const handledChatTurnRef = useRef<AssistantTurn | null>(null);
	const applyFieldsRef = useRef(applyFields);
	const navigateRef = useRef(navigate);
	const sessionRef = useRef(session);
	applyFieldsRef.current = applyFields;
	navigateRef.current = navigate;
	sessionRef.current = session;
	const requestContextRef = useRef({
		language,
		pathname,
		currentForm,
		pageContent,
	});
	requestContextRef.current = {
		language,
		pathname,
		currentForm,
		pageContent,
	};
	const pageIdentity = `${pathname}:${language}`;

	useEffect(() => {
		if (!pageIdentity) return;
		let frame = 0;
		let observer: MutationObserver | null = null;
		const refresh = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const next = readablePageContent();
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
		return () => {
			cancelAnimationFrame(frame);
			observer?.disconnect();
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
						pathname: context.pathname,
						pageContent: context.pageContent,
						currentForm: context.currentForm
							? {
									id: context.currentForm.form.id,
									title: context.currentForm.form.title,
									heading: context.currentForm.form.heading,
									categoryPath: context.currentForm.form.categoryPath,
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
									})),
								}
							: null,
					},
				};
			}),
		[],
	);

	const chatState = useChat({
		connection,
		outputSchema: assistantTurnSchema,
		onError: () => {
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
		if (
			!chatState.final ||
			!speakFallbackRef.current ||
			typeof window === "undefined" ||
			!("speechSynthesis" in window)
		)
			return;
		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(chatState.final.message);
		utterance.lang = /[\u0900-\u097f]/.test(chatState.final.message)
			? "hi-IN"
			: "en-IN";
		window.speechSynthesis.speak(utterance);
		speakFallbackRef.current = false;
	}, [chatState.final]);

	const liveTools = useMemo(() => {
		const searchTool = searchGrievanceCatalogueDef.client(async ({ query }) => {
			const results = await searchCatalogue(query, { limit: 5 });
			return {
				results: results.map((result) => ({
					formId: result.id,
					authoritySlug: result.authoritySlug,
					authorityName: result.authorityName,
					title: result.title,
					categoryPath: result.categoryPath,
				})),
				status: results.length ? ("found" as const) : ("not-found" as const),
				catalogueOnly: true as const,
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
					const destination = `/services/${authoritySlug}/form/${formId}`;
					if (!sessionRef.current?.user) {
						await navigateRef.current({
							to: "/login",
							search: { redirect: destination },
						});
						return {
							opened: false,
							requiresLogin: true,
							reason:
								"The citizen must sign in manually before the form opens.",
						};
					}
					await navigateRef.current({
						to: "/services/$authoritySlug/form/$formId",
						params: { authoritySlug, formId },
						search: { review: false, draft: undefined },
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
		const fillTool = fillVisibleFormDef.client(({ fields }) =>
			applyFieldsRef.current(fields),
		);
		return clientTools(searchTool, openTool, fillTool);
	}, []);

	const currentCatalogueForm = currentForm?.form ?? null;
	const visibleFormDescription = useMemo(
		() =>
			currentCatalogueForm
				? {
						id: currentCatalogueForm.id,
						title: currentCatalogueForm.title,
						heading: currentCatalogueForm.heading,
						categoryPath: currentCatalogueForm.categoryPath,
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
							})),
					}
				: null,
		[currentCatalogueForm],
	);

	const voiceInstructions = useMemo(
		() =>
			[
				"You are UGAAP's voice grievance guide.",
				`Detect the language of every citizen utterance from its grammar and majority language. Reply in English when they speak English. Reply in simple natural Hindi when they speak Hindi or Hinglish. Indian names and official or legal terms such as Aadhaar, benami, pension, PAN, and ministry inside an English utterance do not make it Hindi. Do not use the website's ${language === "hi" ? "Hindi" : "English"} interface setting to choose the reply language.`,
				"Keep replies short and conversational. Never invent a grievance form or government action.",
				"UGAAP's cached grievance catalogue and PAGE_CONTENT are your only sources. Never browse, search, recommend, or claim to visit an external government, municipal, ministry, or department website.",
				"Always call search_grievance_catalogue before naming a route. If the first search has no results and the responsible UGAAP authority or topic is clear, make at most one final catalogue search using that authority or topic with 'miscellaneous' or 'others'. Use a catch-all only when it belongs to that same authority and topic.",
				"If the direct and catch-all catalogue searches do not find a route, plainly admit that it is not available in the current UGAAP catalogue and stop. Do not continue searching, promise to search later, or direct the citizen to an external site.",
				"Open a form only after the citizen explicitly asks to continue.",
				"Filing and form filling require manual sign-in. Never submit a grievance or claim it was submitted.",
				"Read PAGE_CONTENT and VISIBLE_FORM semantically. Never require the citizen to quote an exact heading, field label, or internal field ID.",
				"When the citizen supplies information for a visible form, infer the matching field from its label, kind, placeholder, constraints, and options, then call fill_visible_form with its internal id. When a natural answer maps unambiguously to one exact select option, use it without asking the citizen to repeat or confirm the label. Ask only when the information itself is genuinely ambiguous. Never fill a value the citizen did not provide.",
				visibleFormDescription
					? `VISIBLE_FORM: ${JSON.stringify(visibleFormDescription)}`
					: "No grievance form is visible.",
				`PAGE_CONTENT: ${pageContent || "No readable page content was captured."}`,
			].join("\n"),
		[language, pageContent, visibleFormDescription],
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
		tools: liveTools,
		autoCapture: true,
		autoPlayback: true,
		instructions: voiceInstructions,
		voice: "Kore",
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
		onError: () =>
			setNotice(
				translate(
					text({
						en: "Gemini Live is unavailable. Voice will use your browser when supported.",
						hi: "Gemini Live उपलब्ध नहीं है। संभव होने पर आवाज़ के लिए ब्राउज़र का उपयोग होगा।",
					}),
				),
			),
	});

	useEffect(() => {
		realtime.updateSession({
			instructions: voiceInstructions,
			voice: "Kore",
			vadMode: "server",
			outputModalities: ["audio", "text"],
		});
	}, [realtime.updateSession, voiceInstructions]);

	const setVoiceEnabled = useCallback((enabled: boolean) => {
		voiceRequestedRef.current = enabled;
		setVoiceRequested(enabled);
	}, []);

	function stopBrowserVoice() {
		const recognition = recognitionRef.current;
		if (recognition) {
			recognition.onresult = null;
			recognition.onerror = null;
			recognition.onend = null;
			recognition.stop();
			recognitionRef.current = null;
		}
		setBrowserListening(false);
	}

	async function submit(event?: FormEvent) {
		event?.preventDefault();
		const message = input.trim();
		if (!message || chatState.isLoading) return;
		setNotice(null);
		setInput("");
		await chatState.sendMessage(message);
	}

	const startBrowserVoice = useCallback(() => {
		const Recognition = browserRecognitionConstructor();
		if (!Recognition) {
			setVoiceEnabled(false);
			setNotice(
				translate(
					text({
						en: "Voice input is not supported here. You can continue by typing.",
						hi: "यहाँ आवाज़ से लिखना उपलब्ध नहीं है। आप टाइप करके जारी रख सकते हैं।",
					}),
				),
			);
			return;
		}
		const recognition = new Recognition();
		recognition.lang = language === "hi" ? "hi-IN" : "en-IN";
		recognition.continuous = false;
		recognition.interimResults = false;
		recognition.onresult = (event) => {
			const transcript = event.results[0]?.[0]?.transcript?.trim();
			if (!transcript) return;
			speakFallbackRef.current = true;
			void chatState.sendMessage(transcript);
		};
		recognition.onerror = () => {
			recognitionRef.current = null;
			setBrowserListening(false);
			setVoiceEnabled(false);
		};
		recognition.onend = () => {
			if (recognitionRef.current !== recognition) return;
			recognitionRef.current = null;
			setBrowserListening(false);
			setVoiceEnabled(false);
		};
		recognitionRef.current = recognition;
		setBrowserListening(true);
		recognition.start();
	}, [chatState.sendMessage, language, setVoiceEnabled, translate]);

	async function stopVoice() {
		setVoiceEnabled(false);
		stopBrowserVoice();
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
			browserListening ||
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
			await stopVoice();
			return;
		}
		setVoiceEnabled(true);
		try {
			realtime.updateSession({
				instructions: voiceInstructions,
				voice: "Kore",
				vadMode: "server",
				outputModalities: ["audio", "text"],
			});
			await realtime.connect();
		} catch {
			await realtime.disconnect().catch(() => undefined);
			if (voiceRequestedRef.current) startBrowserVoice();
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
							en: "The live voice session ended. Using browser voice for this message.",
							hi: "लाइव आवाज़ सत्र बंद हो गया। इस संदेश के लिए ब्राउज़र की आवाज़ सुविधा का उपयोग हो रहा है।",
						}),
					),
				);
				startBrowserVoice();
			});
	}, [realtime.disconnect, realtime.status, startBrowserVoice, translate]);

	useEffect(
		() => () => {
			voiceRequestedRef.current = false;
			const recognition = recognitionRef.current;
			if (recognition) {
				recognition.onresult = null;
				recognition.onerror = null;
				recognition.onend = null;
				recognition.stop();
			}
			if (typeof window !== "undefined" && "speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
		},
		[],
	);

	async function openRecommendation(turn: typeof chatState.final) {
		if (!turn?.formId || !turn.authoritySlug) return;
		const destination = `/services/${turn.authoritySlug}/form/${turn.formId}`;
		if (!session?.user) {
			await navigate({ to: "/login", search: { redirect: destination } });
			return;
		}
		await navigate({
			to: "/services/$authoritySlug/form/$formId",
			params: { authoritySlug: turn.authoritySlug, formId: turn.formId },
			search: { review: false, draft: undefined },
		});
	}

	useEffect(() => {
		const turn = chatState.final;
		if (!turn || chatState.isLoading || handledChatTurnRef.current === turn)
			return;
		handledChatTurnRef.current = turn;

		if (
			turn.intent === "fill-form" &&
			currentForm &&
			turn.extractedFields.length
		) {
			const result = applyFields(turn.extractedFields);
			setNotice(
				translate(
					text({
						en: `${result.applied} form fields filled. Review them before continuing.`,
						hi: `${result.applied} फ़ील्ड भर दिए गए हैं। आगे बढ़ने से पहले उनकी जाँच करें।`,
					}),
				),
			);
			return;
		}

		if (turn.intent !== "navigate" && turn.intent !== "login-required") return;
		const destination =
			turn.formId && turn.authoritySlug
				? `/services/${turn.authoritySlug}/form/${turn.formId}`
				: "/services";
		if (!session?.user) {
			void navigate({
				to: "/login",
				search: { redirect: destination },
			});
			return;
		}
		if (turn.formId && turn.authoritySlug) {
			void navigate({
				to: "/services/$authoritySlug/form/$formId",
				params: {
					authoritySlug: turn.authoritySlug,
					formId: turn.formId,
				},
				search: { review: false, draft: undefined },
			});
		}
	}, [
		applyFields,
		chatState.final,
		chatState.isLoading,
		currentForm,
		navigate,
		session?.user,
		translate,
	]);

	const voiceActive = voiceRequested;
	const assistantBusy = voiceActive || chatState.isLoading;
	const voiceLabel = browserListening
		? "listening"
		: realtime.status === "connected"
			? realtime.mode
			: realtime.status === "idle"
				? "switching"
				: realtime.status;
	const latestDockReply =
		realtime.pendingUserTranscript ??
		chatState.final?.message ??
		chatState.partial.message ??
		realtime.pendingAssistantTranscript;

	return (
		<>
			<Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
				<SheetContent
					className="w-[min(100vw,32rem)] gap-0 border-l border-blue-200 bg-white p-0 sm:max-w-[32rem]"
					showCloseButton={false}
				>
					<SheetHeader className="border-b border-blue-200 px-5 py-4">
						<div className="flex items-start gap-3 pr-1">
							<div className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-800 text-white">
								<Bot size={19} aria-hidden="true" />
							</div>
							<div className="min-w-0 flex-1">
								<SheetTitle className="text-base text-blue-950">
									{translate(
										text({ en: "Grievance guide", hi: "शिकायत मार्गदर्शक" }),
									)}
								</SheetTitle>
								<SheetDescription className="mt-0.5 leading-5 text-slate-600">
									{translate(
										text({
											en: "Describe the issue in your own words.",
											hi: "अपनी समस्या अपने शब्दों में बताइए।",
										}),
									)}
								</SheetDescription>
							</div>
							{assistantBusy ? (
								<button
									type="button"
									onClick={() => void stopAssistant()}
									className="inline-flex min-h-9 shrink-0 items-center gap-1.5 border border-red-300 px-2.5 text-xs font-semibold text-red-800 transition-colors hover:border-red-500 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700"
								>
									<Square size={13} fill="currentColor" aria-hidden="true" />
									{translate(text({ en: "Stop", hi: "रोकें" }))}
								</button>
							) : null}
							<SheetClose className="grid size-9 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-blue-50 hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-blue-700">
								<X size={18} />
								<span className="sr-only">
									{translate(text({ en: "Close guide", hi: "मार्गदर्शक बंद करें" }))}
								</span>
							</SheetClose>
						</div>
					</SheetHeader>

					<div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
						{chatState.messages.length === 0 &&
						realtime.messages.length === 0 ? (
							<div className="px-5 py-7 text-sm leading-6 text-slate-600">
								<p className="m-0 font-semibold text-blue-950">
									{translate(text({ en: "You can ask:", hi: "आप पूछ सकते हैं:" }))}
								</p>
								<p className="mb-0 mt-2">
									{translate(
										text({
											en: "“My pension payment has stopped. Where should I complain?”",
											hi: "“मेरी पेंशन रुक गई है। शिकायत कहाँ करूँ?”",
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
										className="border-b border-blue-100 bg-blue-50/60 px-5 py-4 text-sm leading-6 text-blue-950"
									>
										<span className="mb-1 block text-xs font-bold uppercase tracking-wider text-blue-700">
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
									className="border-b border-blue-100 px-5 py-5 text-sm leading-6 text-slate-700"
								>
									<span className="mb-1 block text-xs font-bold uppercase tracking-wider text-blue-700">
										UGAAP
									</span>
									<p className="m-0">{turn.message}</p>
									{turn.formId && turn.authoritySlug ? (
										<div className="mt-4 border-l-2 border-blue-700 pl-3">
											<p className="m-0 text-xs font-semibold text-blue-700">
												{turn.authorityName}
											</p>
											<p className="mb-3 mt-1 font-semibold text-blue-950">
												{turn.formTitle}
											</p>
											<button
												type="button"
												onClick={() =>
													void openRecommendation(structured?.data ?? null)
												}
												className="inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
											>
												{session?.user
													? translate(
															text({ en: "Open this form", hi: "यह फ़ॉर्म खोलें" }),
														)
													: translate(
															text({
																en: "Sign in to continue",
																hi: "जारी रखने के लिए साइन इन करें",
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
									className={`border-b border-blue-100 px-5 py-4 text-sm leading-6 ${message.role === "user" ? "bg-blue-50/60 text-blue-950" : "text-slate-700"}`}
								>
									{content}
								</div>
							) : null;
						})}
						{realtime.pendingUserTranscript ||
						realtime.pendingAssistantTranscript ? (
							<div className="border-b border-blue-100 px-5 py-4 text-sm italic text-slate-500">
								{realtime.pendingUserTranscript ??
									realtime.pendingAssistantTranscript}
							</div>
						) : null}
						{chatState.isLoading ? (
							<div className="flex items-center gap-2 px-5 py-4 text-sm text-slate-500">
								<LoaderCircle className="animate-spin" size={17} />
								{translate(
									text({
										en: "Finding the right route…",
										hi: "सही रास्ता खोज रहे हैं…",
									}),
								)}
							</div>
						) : null}
					</div>

					{notice || canUndo ? (
						<div className="flex items-center justify-between gap-3 border-t border-blue-200 bg-blue-50/70 px-5 py-3 text-xs leading-5 text-blue-950">
							<span>{notice}</span>
							{canUndo ? (
								<button
									type="button"
									onClick={undoLastFill}
									className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-blue-800 hover:text-blue-950"
								>
									<Undo2 size={14} />
									{translate(text({ en: "Undo", hi: "वापस करें" }))}
								</button>
							) : null}
						</div>
					) : null}

					<form onSubmit={(event) => void submit(event)} className="hidden">
						<label className="sr-only" htmlFor="ugaap-assistant-input">
							{translate(
								text({
									en: "Message the grievance guide",
									hi: "शिकायत मार्गदर्शक को संदेश दें",
								}),
							)}
						</label>
						<textarea
							id="ugaap-assistant-input"
							rows={3}
							value={input}
							onChange={(event) => setInput(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									void submit();
								}
							}}
							placeholder={translate(
								text({ en: "What happened?", hi: "क्या हुआ?" }),
							)}
							className="w-full resize-none border border-blue-300 bg-white px-3 py-2.5 text-sm leading-6 text-blue-950 outline-none placeholder:text-slate-500 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
						/>
						<div className="mt-3 flex items-center justify-between gap-3">
							<button
								type="button"
								onClick={() => void toggleVoice()}
								className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${voiceActive ? "border-blue-800 bg-blue-800 text-white" : "border-blue-300 text-blue-800 hover:bg-blue-50"}`}
							>
								{voiceActive ? <MicOff size={17} /> : <Mic size={17} />}
								{voiceActive
									? translate(
											text({
												en: voiceLabel,
												hi: voiceLabel === "listening" ? "सुन रहे हैं" : "आवाज़ चालू",
											}),
										)
									: translate(text({ en: "Speak", hi: "बोलें" }))}
							</button>
							<div className="flex items-center gap-2">
								{chatState.isLoading ? (
									<button
										type="button"
										onClick={chatState.stop}
										className="grid size-10 place-items-center rounded-full border border-blue-300 text-blue-800 hover:bg-blue-50"
									>
										<Square size={15} />
										<span className="sr-only">
											{translate(text({ en: "Stop response", hi: "जवाब रोकें" }))}
										</span>
									</button>
								) : null}
								<button
									type="submit"
									disabled={!input.trim() || chatState.isLoading}
									className="grid size-10 place-items-center rounded-full bg-blue-800 text-white hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-40"
								>
									<Send size={17} />
									<span className="sr-only">
										{translate(text({ en: "Send", hi: "भेजें" }))}
									</span>
								</button>
							</div>
						</div>
						<p className="mb-0 mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-slate-500">
							<Volume2 size={13} />
							{translate(
								text({
									en: "Voice starts only when you tap Speak. Review every form detail yourself.",
									hi: "आवाज़ केवल ‘बोलें’ दबाने पर शुरू होती है। फ़ॉर्म की हर जानकारी खुद जाँचें।",
								}),
							)}
						</p>
					</form>
				</SheetContent>
			</Sheet>
			<form
				onSubmit={(event) => void submit(event)}
				className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl border border-blue-300 bg-white shadow-[0_18px_55px_rgba(15,59,138,0.2)] sm:inset-x-6 sm:bottom-5"
			>
				<div className="flex min-h-10 items-center gap-2 border-b border-blue-200 px-3 py-1.5 sm:px-4">
					<Bot
						className="shrink-0 text-blue-800"
						size={18}
						aria-hidden="true"
					/>
					<span className="min-w-0 flex-1 truncate text-xs font-semibold text-blue-950 sm:text-sm">
						{translate(
							text({
								en: "Ask UGAAP to find, open or help fill this page",
								hi: "इस पेज को खोजने, खोलने या भरने के लिए UGAAP से कहें",
							}),
						)}
					</span>
					<fieldset className="flex shrink-0 items-center border border-blue-200 bg-blue-50/60 p-0.5">
						<legend className="sr-only">
							{translate(text({ en: "Input mode", hi: "इनपुट का तरीका" }))}
						</legend>
						<button
							type="button"
							onClick={() => {
								if (voiceRequestedRef.current) void stopVoice();
								inputRef.current?.focus();
							}}
							aria-pressed={!voiceActive}
							className={`inline-flex min-h-8 items-center gap-1.5 px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-700 ${!voiceActive ? "bg-white text-blue-950 shadow-sm" : "text-slate-600 hover:text-blue-900"}`}
						>
							<Keyboard size={14} aria-hidden="true" />
							<span className="hidden sm:inline">
								{translate(text({ en: "Text", hi: "टेक्स्ट" }))}
							</span>
						</button>
						<button
							type="button"
							onClick={() => void toggleVoice()}
							aria-pressed={voiceActive}
							className={`inline-flex min-h-8 items-center gap-1.5 px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-blue-700 ${voiceActive ? "bg-blue-800 text-white" : "text-slate-600 hover:text-blue-900"}`}
						>
							{voiceActive ? (
								<MicOff size={14} aria-hidden="true" />
							) : (
								<Mic size={14} aria-hidden="true" />
							)}
							<span className="hidden sm:inline">
								{voiceActive
									? translate(
											text({
												en: voiceLabel,
												hi: voiceLabel === "listening" ? "सुन रहे हैं" : "आवाज़ चालू",
											}),
										)
									: translate(text({ en: "Voice", hi: "आवाज़" }))}
							</span>
						</button>
					</fieldset>
					{assistantBusy ? (
						<button
							type="button"
							onClick={() => void stopAssistant()}
							className="inline-flex min-h-8 shrink-0 items-center gap-1.5 border border-red-300 px-2 text-xs font-semibold text-red-800 transition-colors hover:border-red-500 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700"
						>
							<Square size={13} fill="currentColor" aria-hidden="true" />
							<span>{translate(text({ en: "Stop", hi: "रोकें" }))}</span>
						</button>
					) : null}
					<button
						type="button"
						onClick={() => setHistoryOpen(true)}
						className="grid size-9 shrink-0 place-items-center text-blue-800 transition-colors hover:bg-blue-50 hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-blue-700"
						aria-label={translate(
							text({ en: "View conversation", hi: "बातचीत देखें" }),
						)}
					>
						<MessageSquareText size={17} aria-hidden="true" />
					</button>
				</div>
				<div className="flex items-end gap-2 px-3 py-2.5 sm:px-4">
					<label className="sr-only" htmlFor="ugaap-command-input">
						{translate(
							text({
								en: "Tell UGAAP what to do",
								hi: "UGAAP को बताएँ कि क्या करना है",
							}),
						)}
					</label>
					<textarea
						ref={inputRef}
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
								en: "For example: find the right pension grievance form",
								hi: "उदाहरण: पेंशन शिकायत का सही फ़ॉर्म खोजें",
							}),
						)}
						className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-blue-950 outline-none placeholder:text-slate-500"
					/>
					<button
						type="submit"
						disabled={!input.trim() || chatState.isLoading}
						className="grid size-10 shrink-0 place-items-center bg-blue-800 text-white transition-colors hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{chatState.isLoading ? (
							<LoaderCircle
								className="animate-spin"
								size={17}
								aria-hidden="true"
							/>
						) : (
							<Send size={17} aria-hidden="true" />
						)}
						<span className="sr-only">
							{translate(text({ en: "Send", hi: "भेजें" }))}
						</span>
					</button>
				</div>
				{latestDockReply ? (
					<div className="flex items-start gap-2 border-t border-blue-200 px-4 py-2.5 text-xs leading-5 text-slate-700">
						<Bot
							className="mt-0.5 shrink-0 text-blue-800"
							size={14}
							aria-hidden="true"
						/>
						<p className="m-0 min-w-0 flex-1 line-clamp-2">{latestDockReply}</p>
						<button
							type="button"
							onClick={() => setHistoryOpen(true)}
							className="shrink-0 font-semibold text-blue-800 hover:text-blue-950 focus-visible:outline-2 focus-visible:outline-blue-700"
						>
							{translate(text({ en: "View", hi: "देखें" }))}
						</button>
					</div>
				) : null}
				{notice || canUndo ? (
					<div className="flex items-center justify-between gap-3 border-t border-blue-200 bg-blue-50/70 px-4 py-2 text-xs leading-5 text-blue-950">
						<span className="truncate">{notice}</span>
						{canUndo ? (
							<button
								type="button"
								onClick={undoLastFill}
								className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-blue-800 hover:text-blue-950"
							>
								<Undo2 size={14} aria-hidden="true" />
								{translate(text({ en: "Undo", hi: "वापस करें" }))}
							</button>
						) : null}
					</div>
				) : null}
			</form>
		</>
	);
}
