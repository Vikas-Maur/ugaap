import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
	getCurrentSession,
	getDemoLoginConfig,
	sanitizeRedirectPath,
} from "#/features/auth/functions";
import { useI18n } from "#/features/i18n/i18n";
import { hasPendingIntent } from "#/features/intent";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/login")({
	validateSearch: (search) => ({
		redirect: sanitizeRedirectPath(search.redirect),
	}),
	beforeLoad: async ({ search }) => {
		if (await getCurrentSession()) throw redirect({ to: search.redirect });
	},
	loader: () => getDemoLoginConfig({ data: {} }),
	component: LoginScreen,
});

function LoginScreen() {
	const { text } = useI18n();
	const navigate = useNavigate();
	const search = Route.useSearch();
	const demoConfig = Route.useLoaderData();
	const [identifier, setIdentifier] = useState(
		demoConfig.enabled ? demoConfig.username : "",
	);
	const [password, setPassword] = useState(
		demoConfig.enabled ? demoConfig.password : "",
	);
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function finishLogin() {
		const destination = hasPendingIntent() ? "/continuation" : search.redirect;
		await navigate({ to: destination });
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		const normalizedIdentifier = identifier.trim().toLowerCase();
		const email =
			demoConfig.enabled && normalizedIdentifier === demoConfig.username
				? demoConfig.email
				: normalizedIdentifier;
		const result = await authClient.signIn.email({ email, password });
		if (result.error) {
			setError(
				text({
					en: "Those details did not work. Check the username or email and password.",
					hi: "ये विवरण सही नहीं हैं। उपयोगकर्ता नाम या ईमेल और पासवर्ड जाँचें।",
				}),
			);
			setBusy(false);
			return;
		}
		await finishLogin();
	}

	return (
		<div className="relative overflow-hidden">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_24%,rgba(145,185,255,0.28),transparent_31rem)]" />
			<div className="relative mx-auto grid min-h-[calc(100svh-72px)] w-full max-w-[1180px] grid-cols-1 items-center gap-14 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)] md:gap-[clamp(64px,10vw,150px)] md:py-20 lg:px-8">
				<section>
					<p className="mb-5 text-sm font-semibold text-[var(--blue-700)]">
						{text({
							en: "Your grievance workspace",
							hi: "आपका शिकायत कार्यस्थल",
						})}
					</p>
					<h1
						id="login-heading"
						className="m-0 max-w-[650px] text-[clamp(3rem,6vw,6rem)] font-semibold leading-[0.95] tracking-[-0.068em] text-[var(--blue-950)]"
					>
						{text({
							en: "Continue where you left off.",
							hi: "जहाँ रुके थे, वहीं से आगे बढ़ें।",
						})}
					</h1>
					<p className="mt-7 max-w-[560px] text-[1.05rem] leading-7 text-[var(--ink-muted)]">
						{text({
							en: "Your drafts and grievance activity stay connected to your account.",
							hi: "आपके मसौदे और शिकायत की गतिविधि आपके खाते से जुड़ी रहती है।",
						})}
					</p>
					<div className="mt-12 flex max-w-[520px] items-center gap-3 border-y border-[var(--line)] py-5 text-sm text-[var(--ink-muted)]">
						<span className="size-2 rounded-full bg-[var(--blue-600)]" />
						{text({
							en: "Saved work, responses and decisions remain in one timeline.",
							hi: "सहेजा काम, जवाब और निर्णय एक ही समयक्रम में रहते हैं।",
						})}
					</div>
				</section>

				<section
					className="border-t border-[var(--line-strong)] pt-8 md:border-l md:border-t-0 md:pl-[clamp(34px,5vw,70px)] md:pt-0"
					aria-labelledby="login-form-title"
				>
					<div className="mb-8">
						<h2
							id="login-form-title"
							className="m-0 text-2xl font-semibold tracking-[-0.035em] text-[var(--blue-950)]"
						>
							{text({ en: "Sign in", hi: "साइन इन करें" })}
						</h2>
						{demoConfig.enabled ? (
							<p className="mt-2 text-sm leading-6 text-[var(--ink-muted)]">
								{text({
									en: "The shared test account is already filled in.",
									hi: "साझा परीक्षण खाता पहले से भरा हुआ है।",
								})}
							</p>
						) : null}
					</div>
					<form onSubmit={submit} className="grid gap-5">
						<label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
							<span>
								{text({ en: "Email or username", hi: "ईमेल या उपयोगकर्ता नाम" })}
							</span>
							<input
								type="text"
								name="username"
								autoComplete="username"
								spellCheck={false}
								required
								value={identifier}
								onChange={(event) => setIdentifier(event.target.value)}
								className="min-h-12 w-full rounded-xl border border-[var(--line-strong)] bg-white px-4 text-base text-[var(--ink)] outline-none transition focus:border-[var(--blue-700)] focus:ring-3 focus:ring-[var(--blue-100)]"
							/>
						</label>
						<label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
							<span>{text({ en: "Password", hi: "पासवर्ड" })}</span>
							<span className="flex min-h-12 items-center rounded-xl border border-[var(--line-strong)] bg-white pr-2 focus-within:border-[var(--blue-700)] focus-within:ring-3 focus-within:ring-[var(--blue-100)]">
								<input
									type={showPassword ? "text" : "password"}
									name="password"
									autoComplete="current-password"
									required
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									className="min-h-11 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-4 text-base text-[var(--ink)] outline-none"
								/>
								<button
									type="button"
									onClick={() => setShowPassword((value) => !value)}
									className="grid size-9 shrink-0 place-items-center rounded-full border-0 bg-transparent text-[var(--ink-muted)] hover:bg-[var(--blue-50)] hover:text-[var(--blue-800)] focus-visible:outline-3 focus-visible:outline-[var(--blue-200)]"
									aria-label={text(
										showPassword
											? { en: "Hide password", hi: "पासवर्ड छिपाएँ" }
											: { en: "Show password", hi: "पासवर्ड दिखाएँ" },
									)}
								>
									{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
								</button>
							</span>
						</label>
						{error ? (
							<p
								role="alert"
								className="m-0 border-l-3 border-[var(--danger)] pl-3 text-sm leading-6 text-[var(--danger)]"
							>
								{error}
							</p>
						) : null}
						<button
							type="submit"
							disabled={busy}
							className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--blue-700)] bg-[var(--blue-700)] px-5 font-semibold text-white transition hover:border-[var(--blue-900)] hover:bg-[var(--blue-900)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue-300)] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{text(
								busy
									? { en: "Signing in…", hi: "साइन इन हो रहा है…" }
									: { en: "Sign in", hi: "साइन इन करें" },
							)}
							{busy ? null : <ArrowRight size={17} aria-hidden="true" />}
						</button>
					</form>
					<p className="mt-7 text-sm text-[var(--ink-muted)]">
						{text({ en: "New to UGAAP?", hi: "UGAAP पर नए हैं?" })}{" "}
						<Link
							to="/register"
							search={{ redirect: search.redirect }}
							className="font-semibold text-[var(--blue-800)] underline decoration-[var(--blue-300)] decoration-2 underline-offset-4 hover:text-[var(--blue-950)]"
						>
							{text({ en: "Create an account", hi: "खाता बनाएँ" })}
						</Link>
					</p>
				</section>
			</div>
		</div>
	);
}
