import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
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

function RegisterScreen() {
	const { text } = useI18n();
	const navigate = useNavigate();
	const search = Route.useSearch();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
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
		<div className="mx-auto grid min-h-[650px] w-full max-w-[1120px] grid-cols-1 items-center gap-[52px] px-4 py-[68px] sm:px-6 md:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.75fr)] md:gap-[clamp(60px,10vw,160px)] md:py-[82px] md:pb-[100px]">
			<section>
				<p className="mb-3 text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-[var(--blue-700)]">
					{text({ en: "Citizen account", hi: "नागरिक खाता" })}
				</p>
				<h1
					id="register-heading"
					className="m-0 max-w-3xl text-[clamp(2.7rem,5vw,5rem)] font-extrabold leading-[0.98] tracking-[-0.06em] text-[var(--blue-950)]"
				>
					{text({ en: "Create your account", hi: "अपना खाता बनाएँ" })}
				</h1>
				<p className="mt-7 max-w-[590px] text-[1.02rem] leading-[1.72] text-[var(--ink-muted)]">
					{text({
						en: "Save your grievance draft and return to it later.",
						hi: "अपनी शिकायत का मसौदा सुरक्षित करें और बाद में लौटें।",
					})}
				</p>
				<ol className="m-0 mt-14 list-none border-t border-[var(--line-strong)] p-0">
					<li className="grid grid-cols-[54px_1fr] gap-3.5 border-b border-[var(--line)] py-[18px] font-semibold text-[var(--ink)]">
						<span className="text-[0.72rem] font-extrabold tracking-[0.12em] text-[var(--blue-700)]">
							01
						</span>
						{text({ en: "Save drafts privately", hi: "मसौदे निजी रूप से सहेजें" })}
					</li>
					<li className="grid grid-cols-[54px_1fr] gap-3.5 border-b border-[var(--line)] py-[18px] font-semibold text-[var(--ink)]">
						<span className="text-[0.72rem] font-extrabold tracking-[0.12em] text-[var(--blue-700)]">
							02
						</span>
						{text({
							en: "Continue across devices",
							hi: "अलग उपकरण पर जारी रखें",
						})}
					</li>
					<li className="grid grid-cols-[54px_1fr] gap-3.5 border-b border-[var(--line)] py-[18px] font-semibold text-[var(--ink)]">
						<span className="text-[0.72rem] font-extrabold tracking-[0.12em] text-[var(--blue-700)]">
							03
						</span>
						{text({ en: "Keep one clear history", hi: "एक स्पष्ट क्रम बनाए रखें" })}
					</li>
				</ol>
			</section>
			<section
				className="border-t border-[var(--line-strong)] pt-[34px] md:border-l md:border-t-0 md:pl-[clamp(30px,5vw,72px)] md:pt-0"
				aria-label={text({ en: "Account form", hi: "खाता फ़ॉर्म" })}
			>
				<form onSubmit={submit} className="grid gap-[22px]">
					<label className="grid gap-2 text-sm font-bold text-[var(--ink)]">
						<span>{text({ en: "Name", hi: "नाम" })}</span>
						<input
							required
							value={name}
							onChange={(event) => setName(event.target.value)}
							className="min-h-12 w-full rounded-[2px] border border-[var(--line-strong)] bg-white px-3.5 text-[var(--ink)] outline-none transition focus:border-[var(--blue-700)] focus:outline-3 focus:outline-[var(--blue-100)] focus:outline-offset-0"
						/>
					</label>
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
							minLength={8}
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
						{text({ en: "Create account", hi: "खाता बनाएँ" })}
					</button>
				</form>
				<p className="mt-7 text-[0.84rem] text-[var(--ink-muted)]">
					{text({
						en: "Already have an account?",
						hi: "क्या आपका खाता पहले से है?",
					})}{" "}
					<Link
						to="/login"
						search={{ redirect: search.redirect }}
						className="font-bold text-[var(--blue-800)] underline decoration-[var(--blue-300)] decoration-2 underline-offset-4 transition hover:text-[var(--blue-950)] focus:rounded-[2px] focus:outline-3 focus:outline-[var(--blue-100)] focus:outline-offset-2"
					>
						{text({ en: "Sign in", hi: "साइन इन करें" })}
					</Link>
				</p>
			</section>
		</div>
	);
}
