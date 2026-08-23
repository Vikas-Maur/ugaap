import { setResponseHeader } from "@tanstack/react-start/server";

/**
 * Private handlers must never be shared or cached by an intermediary. Call
 * this before returning session-bound data or processing a mutation.
 */
export function setPrivateResponseHeaders() {
	setResponseHeader("Cache-Control", "no-store");
	setResponseHeader("Vary", "Cookie, Authorization");
}
