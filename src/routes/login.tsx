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
	getDemoLoginConfig,
	sanitizeRedirectPath,
} from "#/features/auth/functions";
import { useI18n } from "#/features/i18n/i18n";
import { hasPendingIntent } from "#/features/intent";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/login")({
	validateSearch: (search) => ({
		redirect:
			typeof search.redirect === "string"
				? sanitizeRedirectPath(search.redirect)
				: "/dashboard",
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
		<AuthPageLayout
			titleId="login-heading"
			eyebrow={text({
				en: "Secure citizen workspace",
				hi: "सुरक्षित नागरिक कार्यस्थल",
			})}
			title={text({ en: "Sign in to UGAAP", hi: "UGAAP में साइन इन करें" })}
			description={text({
				en: "Access your saved drafts, grievance activity and responses.",
				hi: "अपने सहेजे गए मसौदे, शिकायत गतिविधि और जवाब देखें।",
			})}
			footer={
				<p className="m-0">
					{text({ en: "New to UGAAP?", hi: "UGAAP पर नए हैं?" })}{" "}
					<Link
						to="/register"
						search={{ redirect: search.redirect }}
						className="font-semibold text-[var(--blue-800)] underline decoration-[var(--blue-300)] decoration-2 underline-offset-4 hover:text-[var(--blue-950)]"
					>
						{text({ en: "Create an account", hi: "खाता बनाएँ" })}
					</Link>
				</p>
			}
		>
			<form onSubmit={submit} className="grid gap-4">
				{demoConfig.enabled ? (
					<p className="m-0 border-l-2 border-[var(--blue-500)] pl-3 text-sm leading-6 text-[var(--ink-muted)]">
						{text({
							en: "The shared test account is already filled in.",
							hi: "साझा परीक्षण खाता पहले से भरा हुआ है।",
						})}
					</p>
				) : null}

				<label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)]">
					<span>
						{text({
							en: "Email or username",
							hi: "ईमेल या उपयोगकर्ता नाम",
						})}
					</span>
					<input
						type="text"
						name="username"
						autoComplete="username"
						spellCheck={false}
						required
						value={identifier}
						onChange={(event) => setIdentifier(event.target.value)}
						className="field-control"
					/>
				</label>

				<label className="grid gap-1.5 text-sm font-semibold text-[var(--ink)]">
					<span>{text({ en: "Password", hi: "पासवर्ड" })}</span>
					<span className="flex min-h-12 items-center rounded-xl border border-[var(--line)] bg-[var(--paper)] pr-2 transition-[border-color,box-shadow] focus-within:border-[var(--blue-700)] focus-within:ring-3 focus-within:ring-[var(--blue-100)]">
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
							? { en: "Signing in…", hi: "साइन इन हो रहा है…" }
							: { en: "Sign in", hi: "साइन इन करें" },
					)}
					{busy ? null : <ArrowRight size={17} aria-hidden="true" />}
				</button>
			</form>
		</AuthPageLayout>
	);
}
