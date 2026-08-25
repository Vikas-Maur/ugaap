type BrandLogoProps = {
	variant?: "full" | "mark";
	tone?: "default" | "inverse";
};

export function BrandLogo({
	variant = "full",
	tone = "default",
}: BrandLogoProps) {
	if (variant === "mark") {
		return (
			<span
				className={`grid size-10 place-items-center rounded-full border-2 ${
					tone === "inverse"
						? "border-[var(--highlight)] bg-[var(--highlight)] text-[var(--ink)]"
						: "border-[var(--action)] bg-[var(--highlight)] text-[var(--action)]"
				}`}
				aria-hidden="true"
			>
				<svg
					viewBox="0 0 24 24"
					className="size-6"
					fill="none"
					aria-hidden="true"
				>
					<circle
						cx="12"
						cy="12"
						r="7"
						stroke="currentColor"
						strokeWidth="1.7"
					/>
					<path
						d="M5 12h14M12 5v14"
						stroke="currentColor"
						strokeWidth="1.7"
						strokeLinecap="round"
					/>
					<path
						d="M9.5 12h5m0 0-2-2m2 2-2 2"
						stroke="currentColor"
						strokeWidth="1.7"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</span>
		);
	}

	return (
		<img
			className="block h-auto w-[132px] max-w-full sm:w-[154px]"
			src="/brand/ugaap-mark.svg"
			alt="UGAAP"
			width={184}
			height={48}
		/>
	);
}
