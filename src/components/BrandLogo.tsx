type BrandLogoProps = {
	compact?: boolean;
};

export function BrandLogo({ compact = false }: BrandLogoProps) {
	return (
		<img
			className={
				compact
					? "block size-10 object-cover object-left"
					: "block h-auto w-[126px] max-w-full sm:w-[154px]"
			}
			src="/brand/ugaap-mark.svg"
			alt="UGAAP"
			width={compact ? 40 : 184}
			height={48}
		/>
	);
}
