"use client";

import { ScrollArea as ScrollAreaPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "#/lib/utils.ts";

function ScrollArea({
	className,
	children,
	scrollbars = "vertical",
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
	scrollbars?: "vertical" | "horizontal" | "both";
}) {
	return (
		<ScrollAreaPrimitive.Root
			data-slot="scroll-area"
			className={cn("relative overflow-hidden", className)}
			{...props}
		>
			<ScrollAreaPrimitive.Viewport
				data-slot="scroll-area-viewport"
				className="size-full rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-200)]"
			>
				{children}
			</ScrollAreaPrimitive.Viewport>
			{scrollbars === "vertical" || scrollbars === "both" ? (
				<ScrollBar />
			) : null}
			{scrollbars === "horizontal" || scrollbars === "both" ? (
				<ScrollBar orientation="horizontal" />
			) : null}
			<ScrollAreaPrimitive.Corner />
		</ScrollAreaPrimitive.Root>
	);
}

function ScrollBar({
	className,
	orientation = "vertical",
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>) {
	return (
		<ScrollAreaPrimitive.Scrollbar
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			className={cn(
				"flex touch-none select-none p-0.5 transition-colors",
				orientation === "vertical" && "h-full w-2.5",
				orientation === "horizontal" && "h-2.5 flex-col",
				className,
			)}
			{...props}
		>
			<ScrollAreaPrimitive.Thumb
				data-slot="scroll-area-thumb"
				className="relative flex-1 rounded-full bg-[var(--blue-300)] hover:bg-[var(--blue-500)]"
			/>
		</ScrollAreaPrimitive.Scrollbar>
	);
}

export { ScrollArea, ScrollBar };
