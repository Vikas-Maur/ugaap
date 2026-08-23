import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";

import { AuthPageLayout } from "#/components/AuthPageLayout";
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
		<AuthPageLayout
			titleId="register-heading"
			eyebrow={text({
				en: "Citizen account",
				hi: "नागरिक खाता",
			})}
			title={text({
				en: "Create your UGAAP account",
				hi: "अपना UGAAP खाता बनाएँ",
			})}
			description={text({
				en: "Save drafts, return later and keep every response connected to the right grievance.",
				hi: "मसौदे सहेजें, बाद में लौटें और हर जवाब को सही शिकायत से जुड़ा रखें।",
			})}
			footer={
				<p className="m-0">
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
			}
		>
			<form onSubmit={submit} className="grid gap-4">
				<label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)]">
					<span>{text({ en: "Name", hi: "नाम" })}</span>
					<input
						name="name"
						autoComplete="name"
						required
						value={name}
						onChange={(event) => setName(event.target.value)}
						className="field-control"
					/>
				</label>

				<label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)]">
					<span>{text({ en: "Email", hi: "ईमेल" })}</span>
					<input
						type="email"
						name="email"
						autoComplete="email"
						spellCheck={false}
						required
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						className="field-control"
					/>
				</label>

				<label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)]">
					<span>{text({ en: "Password", hi: "पासवर्ड" })}</span>
					<span className="flex min-h-12 items-center rounded-xl border border-[var(--line)] bg-[var(--paper)] pr-2 transition-[border-color,box-shadow] focus-within:border-[var(--blue-700)] focus-within:ring-3 focus-within:ring-[var(--blue-100)]">
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
							className="grid size-9 shrink-0 place-items-center rounded-lg border-0 bg-transparent text-[var(--ink-muted)] hover:bg-[var(--blue-50)] hover:text-[var(--blue-800)] focus-visible:outline-3 focus-visible:outline-[var(--blue-200)]"
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
					className="action-primary mt-1 min-h-12 w-full"
				>
					{text(
						busy
							? { en: "Creating account…", hi: "खाता बन रहा है…" }
							: { en: "Create account", hi: "खाता बनाएँ" },
					)}
					{busy ? null : <ArrowRight size={17} aria-hidden="true" />}
				</button>
			</form>
		</AuthPageLayout>
	);
}
