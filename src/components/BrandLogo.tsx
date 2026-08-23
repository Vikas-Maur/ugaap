type BrandLogoProps = {
	compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
	return (
		<img
			className={
				compact
					? "block h-11 w-11 object-cover object-left"
					: "block h-auto w-[168px] max-w-full"
			}
			src="/brand/ugaap-mark.svg"
			alt="UGAAP"
			width={compact ? 48 : 192}
			height={56}
		/>
	);
}
