import { createFileRoute } from "@tanstack/react-router";
import { NETWORK_PROBE_BYTES } from "#/features/network/probe";

export const Route = createFileRoute("/api/network/probe")({
	server: {
		handlers: {
			GET: () => {
				const payload = new Uint8Array(NETWORK_PROBE_BYTES);
				crypto.getRandomValues(payload);
				return new Response(payload, {
					headers: {
						"Cache-Control": "no-store, max-age=0",
						"Content-Type": "application/octet-stream",
						"Content-Length": String(payload.byteLength),
					},
				});
			},
		},
	},
});
