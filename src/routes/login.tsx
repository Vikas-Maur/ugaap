import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import {
	createDemoSession,
	getCurrentSession,
	isDemoModeEnabled,
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
	component: LoginScreen,
});

function LoginScreen() {
	const { text } = useI18n();
	const navigate = useNavigate();
	const search = Route.useSearch();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [demoEnabled, setDemoEnabled] = useState(false);

	useEffect(() => {
		void isDemoModeEnabled({ data: {} }).then((result) => {
			setDemoEnabled(result.enabled);
		});
	}, []);

	async function finishLogin() {
		const destination = hasPendingIntent() ? "/continuation" : search.redirect;
		await navigate({ to: destination });
	}

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		const result = await authClient.signIn.email({ email, password });
		if (result.error) {
			setError(
				text({
					en: "Those details did not work. Check your email and password.",
					hi: "ये विवरण सही नहीं हैं। अपना ईमेल और पासवर्ड जाँचें।",
				}),
			);
			setBusy(false);
			return;
		}
		await finishLogin();
	}

	async function handleDemo() {
		setBusy(true);
		setError("");
		try {
			await createDemoSession({ data: {} });
			await finishLogin();
		} catch {
			setError(
				text({
					en: "Demo access is unavailable right now.",
					hi: "डेमो सुविधा अभी उपलब्ध नहीं है।",
				}),
			);
			setBusy(false);
		}
	}

	return (
		<div className="mx-auto grid min-h-[650px] w-full max-w-[1120px] grid-cols-1 items-center gap-[52px] px-4 py-[68px] sm:px-6 md:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.75fr)] md:gap-[clamp(60px,10vw,160px)] md:py-[82px] md:pb-[100px]">
			<section>
				<p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-[var(--blue-700)]">
					{text({ en: "Citizen access", hi: "नागरिक प्रवेश" })}
				</p>
				<h1
					id="login-heading"
					className="m-0 max-w-3xl text-[clamp(2.7rem,5vw,5rem)] font-extrabold leading-[0.98] tracking-[-0.06em] text-[var(--blue-950)]"
				>
					{text({ en: "Sign in", hi: "साइन इन करें" })}
				</h1>
				<p className="mt-7 max-w-[590px] text-[1.02rem] leading-[1.72] text-[var(--ink-muted)]">
					{text({
						en: "Continue to your private grievance workspace.",
						hi: "अपने निजी शिकायत कार्यस्थल पर जारी रखें।",
					})}
				</p>
				<ol className="m-0 mt-14 list-none border-t border-[var(--line-strong)] p-0">
					<li className="grid grid-cols-[54px_1fr] gap-3.5 border-b border-[var(--line)] py-[18px] font-semibold text-[var(--ink)]">
						<span className="text-[0.72rem] font-extrabold tracking-[0.12em] text-[var(--blue-700)]">
							01
						</span>
						{text({ en: "Save unfinished work", hi: "अधूरा काम सहेजें" })}
					</li>
					<li className="grid grid-cols-[54px_1fr] gap-3.5 border-b border-[var(--line)] py-[18px] font-semibold text-[var(--ink)]">
						<span className="text-[0.72rem] font-extrabold tracking-[0.12em] text-[var(--blue-700)]">
							02
						</span>
						{text({
							en: "Keep grievance history together",
							hi: "शिकायत का क्रम एक जगह रखें",
						})}
					</li>
					<li className="grid grid-cols-[54px_1fr] gap-3.5 border-b border-[var(--line)] py-[18px] font-semibold text-[var(--ink)]">
						<span className="text-[0.72rem] font-extrabold tracking-[0.12em] text-[var(--blue-700)]">
							03
						</span>
						{text({
							en: "Return without starting again",
							hi: "बिना दोबारा शुरू किए लौटें",
						})}
					</li>
				</ol>
			</section>
			<section
				className="border-t border-[var(--line-strong)] pt-[34px] md:border-l md:border-t-0 md:pl-[clamp(30px,5vw,72px)] md:pt-0"
				aria-label={text({ en: "Sign-in form", hi: "साइन-इन फ़ॉर्म" })}
			>
				<form onSubmit={submit} className="grid gap-[22px]">
					<label className="grid gap-2 text-sm font-bold text-[var(--ink)]">
						<span>{text({ en: "Email", hi: "ईमेल" })}</span>
						<input
							type="email"
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							className="min-h-12 w-full rounded-[2px] border border-[var(--line-strong)] bg-white px-3.5 text-[var(--ink)] outline-none transition focus:border-[var(--blue-700)] focus:outline-3 focus:outline-[var(--blue-100)] focus:outline-offset-0"
						/>
					</label>
					<label className="grid gap-2 text-sm font-bold text-[var(--ink)]">
						<span>{text({ en: "Password", hi: "पासवर्ड" })}</span>
						<input
							type="password"
							required
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							className="min-h-12 w-full rounded-[2px] border border-[var(--line-strong)] bg-white px-3.5 text-[var(--ink)] outline-none transition focus:border-[var(--blue-700)] focus:outline-3 focus:outline-[var(--blue-100)] focus:outline-offset-0"
						/>
					</label>
					{error ? (
						<p role="alert" className="m-0 text-[0.82rem] text-[var(--danger)]">
							{error}
						</p>
					) : null}
					<button
						type="submit"
						disabled={busy}
						className="min-h-12 w-full rounded-[2px] border border-[var(--blue-800)] bg-[var(--blue-800)] px-[18px] font-bold text-white transition hover:border-[var(--blue-950)] hover:bg-[var(--blue-950)] focus:outline-3 focus:outline-[var(--blue-100)] focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{text({ en: "Sign in", hi: "साइन इन करें" })}
					</button>
				</form>
				{demoEnabled ? (
					<button
						type="button"
						onClick={() => void handleDemo()}
						disabled={busy}
						className="mt-3 min-h-12 w-full rounded-[2px] border border-[var(--line-strong)] bg-transparent px-[18px] font-bold text-[var(--blue-900)] transition hover:border-[var(--blue-700)] hover:bg-[var(--blue-50)] focus:outline-3 focus:outline-[var(--blue-100)] focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{text({
							en: "Try an isolated demo account",
							hi: "अलग डेमो खाते से आज़माएँ",
						})}
					</button>
				) : null}
				<p className="mt-7 text-[0.84rem] text-[var(--ink-muted)]">
					{text({ en: "New to UGAAP?", hi: "UGAAP पर नए हैं?" })}{" "}
					<Link
						to="/register"
						search={{ redirect: search.redirect }}
						className="font-bold text-[var(--blue-800)] underline decoration-[var(--blue-300)] decoration-2 underline-offset-4 transition hover:text-[var(--blue-950)] focus:rounded-[2px] focus:outline-3 focus:outline-[var(--blue-100)] focus:outline-offset-2"
					>
						{text({ en: "Create an account", hi: "खाता बनाएँ" })}
					</Link>
				</p>
			</section>
		</div>
	);
}
