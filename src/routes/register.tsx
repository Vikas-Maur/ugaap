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
	sanitizeRedirectPath,
} from "#/features/auth/functions";
import { useI18n } from "#/features/i18n/i18n";
import { hasPendingIntent } from "#/features/intent";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/register")({
	validateSearch: (search) => ({
		redirect: sanitizeRedirectPath(search.redirect),
	}),
	beforeLoad: async ({ search }) => {
		if (await getCurrentSession()) throw redirect({ to: search.redirect });
	},
	component: RegisterScreen,
});

const inputClass =
	"min-h-12 w-full rounded-xl border border-[var(--line-strong)] bg-white px-4 text-base text-[var(--ink)] outline-none transition focus:border-[var(--blue-700)] focus:ring-3 focus:ring-[var(--blue-100)]";

function RegisterScreen() {
	const { text } = useI18n();
	const navigate = useNavigate();
	const search = Route.useSearch();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		const result = await authClient.signUp.email({ name, email, password });
		if (result.error) {
			setError(
				text({
					en: "We could not create that account. Check the details and try again.",
					hi: "खाता नहीं बन सका। विवरण जाँचकर फिर कोशिश करें।",
				}),
			);
			setBusy(false);
			return;
		}
		const destination = hasPendingIntent() ? "/continuation" : search.redirect;
		await navigate({ to: destination });
	}

	return (
		<div className="relative overflow-hidden">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_24%,rgba(145,185,255,0.28),transparent_31rem)]" />
			<div className="relative mx-auto grid min-h-[calc(100svh-72px)] w-full max-w-[1180px] grid-cols-1 items-center gap-14 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)] md:gap-[clamp(64px,10vw,150px)] md:py-20 lg:px-8">
				<section>
					<p className="mb-5 text-sm font-semibold text-[var(--blue-700)]">
						{text({ en: "Create a citizen account", hi: "नागरिक खाता बनाएँ" })}
					</p>
					<h1 className="m-0 max-w-[650px] text-[clamp(3rem,6vw,6rem)] font-semibold leading-[0.95] tracking-[-0.068em] text-[var(--blue-950)]">
						{text({
							en: "Save the work. Keep the history.",
							hi: "काम सहेजें। पूरा क्रम साथ रखें।",
						})}
					</h1>
					<p className="mt-7 max-w-[560px] text-[1.05rem] leading-7 text-[var(--ink-muted)]">
						{text({
							en: "An account lets you pause a grievance, return later and keep responses attached to the right case.",
							hi: "खाते से आप शिकायत रोककर बाद में लौट सकते हैं और जवाब सही मामले के साथ रख सकते हैं।",
						})}
					</p>
					<p className="mt-12 max-w-[520px] border-y border-[var(--line)] py-5 text-sm leading-6 text-[var(--ink-muted)]">
						{text({
							en: "You will review the final details before anything is filed.",
							hi: "कुछ भी दर्ज होने से पहले आप अंतिम विवरण जाँचेंगे।",
						})}
					</p>
				</section>

				<section className="border-t border-[var(--line-strong)] pt-8 md:border-l md:border-t-0 md:pl-[clamp(34px,5vw,70px)] md:pt-0">
					<h2 className="m-0 mb-8 text-2xl font-semibold tracking-[-0.035em] text-[var(--blue-950)]">
						{text({ en: "Your details", hi: "आपका विवरण" })}
					</h2>
					<form onSubmit={submit} className="grid gap-5">
						<label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
							<span>{text({ en: "Name", hi: "नाम" })}</span>
							<input
								name="name"
								autoComplete="name"
								required
								value={name}
								onChange={(event) => setName(event.target.value)}
								className={inputClass}
							/>
						</label>
						<label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
							<span>{text({ en: "Email", hi: "ईमेल" })}</span>
							<input
								type="email"
								name="email"
								autoComplete="email"
								spellCheck={false}
								required
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								className={inputClass}
							/>
						</label>
						<label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
							<span>{text({ en: "Password", hi: "पासवर्ड" })}</span>
							<span className="flex min-h-12 items-center rounded-xl border border-[var(--line-strong)] bg-white pr-2 focus-within:border-[var(--blue-700)] focus-within:ring-3 focus-within:ring-[var(--blue-100)]">
								<input
									type={showPassword ? "text" : "password"}
									name="new-password"
									autoComplete="new-password"
									required
									minLength={8}
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
							<span className="text-xs font-normal text-[var(--ink-faint)]">
								{text({
									en: "Use at least 8 characters.",
									hi: "कम से कम 8 अक्षर रखें।",
								})}
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
									? { en: "Creating account…", hi: "खाता बन रहा है…" }
									: { en: "Create account", hi: "खाता बनाएँ" },
							)}
							{busy ? null : <ArrowRight size={17} aria-hidden="true" />}
						</button>
					</form>
					<p className="mt-7 text-sm text-[var(--ink-muted)]">
						{text({
							en: "Already have an account?",
							hi: "क्या आपका खाता पहले से है?",
						})}{" "}
						<Link
							to="/login"
							search={{ redirect: search.redirect }}
							className="font-semibold text-[var(--blue-800)] underline decoration-[var(--blue-300)] decoration-2 underline-offset-4 hover:text-[var(--blue-950)]"
						>
							{text({ en: "Sign in", hi: "साइन इन करें" })}
						</Link>
					</p>
				</section>
			</div>
		</div>
	);
}
