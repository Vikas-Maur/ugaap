import assert from "node:assert/strict";
import test from "node:test";

import { selectSpeechVoice } from "../../src/features/assistant/speech";

const voices = [
	{ lang: "en-US", localService: true, name: "System English" },
	{ lang: "en-IN", localService: false, name: "Google English India" },
	{ lang: "hi-IN", localService: true, name: "Hindi Neural" },
];

test("Hindi playback selects a Hindi voice", () => {
	assert.equal(selectSpeechVoice(voices, "hi")?.name, "Hindi Neural");
});

test("English playback prefers an Indian English voice", () => {
	assert.equal(
		selectSpeechVoice(voices, "en")?.name,
		"Google English India",
	);
});

test("playback does not select the wrong language", () => {
	assert.equal(
		selectSpeechVoice(
			[{ lang: "en-US", localService: true, name: "English" }],
			"hi",
		),
		null,
	);
});
