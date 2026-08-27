import type { AudioPart } from "@tanstack/ai";

export const TEXT_VOICE_MAX_DURATION_MS = 60_000;
export const TEXT_VOICE_SAMPLE_RATE = 16_000;

function mixToMono(channels: ReadonlyArray<Float32Array>) {
	if (!channels.length) return new Float32Array();
	const frameCount = Math.min(...channels.map((channel) => channel.length));
	const mono = new Float32Array(frameCount);
	for (let frame = 0; frame < frameCount; frame += 1) {
		let sample = 0;
		for (const channel of channels) sample += channel[frame] ?? 0;
		mono[frame] = sample / channels.length;
	}
	return mono;
}

function resampleForSpeech(
	input: Float32Array,
	inputSampleRate: number,
	outputSampleRate: number,
) {
	if (inputSampleRate === outputSampleRate) return input;
	const ratio = inputSampleRate / outputSampleRate;
	const outputLength = Math.max(1, Math.round(input.length / ratio));
	const output = new Float32Array(outputLength);
	if (ratio < 1) {
		for (let index = 0; index < outputLength; index += 1) {
			const position = index * ratio;
			const before = Math.floor(position);
			const after = Math.min(input.length - 1, before + 1);
			const amount = position - before;
			output[index] =
				(input[before] ?? 0) * (1 - amount) + (input[after] ?? 0) * amount;
		}
		return output;
	}
	for (let index = 0; index < outputLength; index += 1) {
		const start = Math.floor(index * ratio);
		const end = Math.min(
			input.length,
			Math.max(start + 1, Math.floor((index + 1) * ratio)),
		);
		let total = 0;
		for (let inputIndex = start; inputIndex < end; inputIndex += 1)
			total += input[inputIndex] ?? 0;
		output[index] = total / (end - start);
	}
	return output;
}

export function encodeSpeechWav(
	channels: ReadonlyArray<Float32Array>,
	inputSampleRate: number,
	outputSampleRate = TEXT_VOICE_SAMPLE_RATE,
) {
	if (!Number.isFinite(inputSampleRate) || inputSampleRate <= 0)
		throw new Error("The microphone sample rate is invalid.");
	const samples = resampleForSpeech(
		mixToMono(channels),
		inputSampleRate,
		outputSampleRate,
	);
	const bytes = new Uint8Array(44 + samples.length * 2);
	const view = new DataView(bytes.buffer);
	const writeText = (offset: number, value: string) => {
		for (let index = 0; index < value.length; index += 1)
			view.setUint8(offset + index, value.charCodeAt(index));
	};

	writeText(0, "RIFF");
	view.setUint32(4, 36 + samples.length * 2, true);
	writeText(8, "WAVE");
	writeText(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, outputSampleRate, true);
	view.setUint32(28, outputSampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeText(36, "data");
	view.setUint32(40, samples.length * 2, true);

	for (let index = 0; index < samples.length; index += 1) {
		const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
		view.setInt16(
			44 + index * 2,
			sample < 0 ? sample * 0x8000 : sample * 0x7fff,
			true,
		);
	}
	return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
	let binary = "";
	const chunkSize = 0x8000;
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		binary += String.fromCharCode(
			...bytes.subarray(offset, offset + chunkSize),
		);
	}
	return window.btoa(binary);
}

export async function recordingToGeminiAudio(blob: Blob): Promise<AudioPart> {
	if (!blob.size) throw new Error("The recording did not contain audio.");
	const AudioContextConstructor =
		window.AudioContext ??
		(window as typeof window & { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!AudioContextConstructor)
		throw new Error("This browser cannot prepare recorded audio.");

	const context = new AudioContextConstructor();
	try {
		const decoded = await context.decodeAudioData(await blob.arrayBuffer());
		if (!decoded.length)
			throw new Error("The recording did not contain audio.");
		const channels = Array.from(
			{ length: decoded.numberOfChannels },
			(_, index) => decoded.getChannelData(index),
		);
		const wav = encodeSpeechWav(channels, decoded.sampleRate);
		return {
			type: "audio",
			source: {
				type: "data",
				value: bytesToBase64(wav),
				mimeType: "audio/wav",
			},
		};
	} finally {
		await context.close().catch(() => undefined);
	}
}
