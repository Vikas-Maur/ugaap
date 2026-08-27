import assert from "node:assert/strict";
import test from "node:test";

import { latestUserInput } from "../../src/features/assistant/input";

test("the latest text message remains a text turn", () => {
	assert.deepEqual(
		latestUserInput([
			{ role: "user", parts: [{ type: "text", content: "Pension stopped" }] },
		]),
		{ text: "Pension stopped", hasAudio: false },
	);
});

test("an audio-only message is accepted as user input", () => {
	assert.deepEqual(
		latestUserInput([
			{
				role: "user",
				content: [
					{
						type: "audio",
						source: { type: "data", value: "audio", mimeType: "audio/wav" },
					},
				],
			},
		]),
		{ text: "", hasAudio: true },
	);
});

test("only the latest user turn controls input detection", () => {
	assert.deepEqual(
		latestUserInput([
			{ role: "user", parts: [{ type: "audio" }] },
			{ role: "assistant", parts: [{ type: "text", content: "Reply" }] },
			{ role: "user", content: "Open my drafts" },
		]),
		{ text: "Open my drafts", hasAudio: false },
	);
});
