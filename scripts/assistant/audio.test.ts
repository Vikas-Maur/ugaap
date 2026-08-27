import assert from "node:assert/strict";
import test from "node:test";

import {
	encodeSpeechWav,
	TEXT_VOICE_SAMPLE_RATE,
} from "../../src/features/assistant/audio";

function ascii(bytes: Uint8Array, start: number, length: number) {
	return String.fromCharCode(...bytes.subarray(start, start + length));
}

test("voice recordings are encoded as mono 16-bit PCM WAV", () => {
	const bytes = encodeSpeechWav(
		[new Float32Array([1, 0.5, -0.5, -1])],
		TEXT_VOICE_SAMPLE_RATE,
	);
	const view = new DataView(bytes.buffer);

	assert.equal(ascii(bytes, 0, 4), "RIFF");
	assert.equal(ascii(bytes, 8, 4), "WAVE");
	assert.equal(ascii(bytes, 12, 4), "fmt ");
	assert.equal(ascii(bytes, 36, 4), "data");
	assert.equal(view.getUint16(20, true), 1);
	assert.equal(view.getUint16(22, true), 1);
	assert.equal(view.getUint32(24, true), TEXT_VOICE_SAMPLE_RATE);
	assert.equal(view.getUint16(34, true), 16);
	assert.equal(view.getUint32(40, true), 8);
	assert.equal(view.getInt16(44, true), 0x7fff);
	assert.equal(view.getInt16(50, true), -0x8000);
});

test("voice recordings are mixed to mono and downsampled to 16 kHz", () => {
	const frames = 48_000;
	const left = new Float32Array(frames).fill(0.75);
	const right = new Float32Array(frames).fill(-0.75);
	const bytes = encodeSpeechWav([left, right], 48_000);
	const view = new DataView(bytes.buffer);

	assert.equal(view.getUint32(40, true), TEXT_VOICE_SAMPLE_RATE * 2);
	assert.equal(view.getInt16(44, true), 0);
});

test("voice recordings with a lower sample rate can be normalized", () => {
	const bytes = encodeSpeechWav([new Float32Array(8_000)], 8_000);
	const view = new DataView(bytes.buffer);
	assert.equal(view.getUint32(40, true), TEXT_VOICE_SAMPLE_RATE * 2);
});

test("invalid microphone sample rates are rejected", () => {
	assert.throws(() => encodeSpeechWav([new Float32Array(10)], 0));
});
