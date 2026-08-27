function elementIsVisible(element: HTMLElement) {
	if (element.closest("[aria-hidden='true'], [data-assistant-private], .assistant-dock"))
		return false;
	const style = window.getComputedStyle(element);
	if (style.display === "none" || style.visibility === "hidden") return false;
	const rect = element.getBoundingClientRect();
	return (
		rect.width > 0 &&
		rect.height > 0 &&
		rect.bottom >= 0 &&
		rect.right >= 0 &&
		rect.top <= window.innerHeight &&
		rect.left <= window.innerWidth
	);
}

function readableElementText(element: HTMLElement) {
	if (element instanceof HTMLInputElement) {
		if (["password", "hidden", "file"].includes(element.type)) return "";
		const label =
			(element.labels?.[0]?.innerText || element.getAttribute("aria-label") || "").trim();
		return label ? `${label}: ${element.value || "empty"}` : "";
	}
	if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
		const label =
			(element.labels?.[0]?.innerText || element.getAttribute("aria-label") || "").trim();
		return label ? `${label}: ${element.value || "empty"}` : "";
	}
	return element.innerText.replace(/\s+/g, " ").trim();
}

export function readableViewportContent() {
	if (typeof document === "undefined") return "";
	const root = document.querySelector<HTMLElement>("[data-assistant-page-content]");
	if (!root) return "";
	const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	const candidates = root.querySelectorAll<HTMLElement>(
		"h1, h2, h3, p, label, legend, th, td, li, a, button, output, input, textarea, select, [role='alert'], [role='status']",
	);
	const seen = new Set<string>();
	const lines: string[] = [];
	for (const element of candidates) {
		if (!elementIsVisible(element)) continue;
		const content = readableElementText(element);
		if (!content || seen.has(content)) continue;
		seen.add(content);
		lines.push(element === active ? `[Focused] ${content}` : content);
		if (lines.join("\n").length >= 8_000) break;
	}
	return lines.join("\n").slice(0, 8_000);
}
