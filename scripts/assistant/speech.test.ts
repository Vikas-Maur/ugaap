import assert from "node:assert/strict";
import test from "node:test";

import {
	canCompleteVoiceResponse,
	selectSpeechVoice,
	splitSpeechText,
} from "../../src/features/assistant/speech";

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

test("speech text is split into short segments without breaking words", () => {
	assert.deepEqual(splitSpeechText("One short sentence. Another answer", 20), [
		"One short sentence.",
		"Another answer",
	]);
});

test("Hindi sentence boundaries are valid speech split points", () => {
	assert.deepEqual(splitSpeechText("पहला वाक्य। दूसरा वाक्य", 13), [
		"पहला वाक्य।",
		"दूसरा वाक्य",
	]);
});

test("a voice response stays open across a submission approval pause", () => {
	assert.equal(
		canCompleteVoiceResponse({
			requestSettled: true,
			approvalPending: true,
			resuming: false,
			loading: false,
		}),
		false,
	);
	assert.equal(
		canCompleteVoiceResponse({
			requestSettled: true,
			approvalPending: false,
			resuming: false,
			loading: false,
		}),
		true,
	);
});
