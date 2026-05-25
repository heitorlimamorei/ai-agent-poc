import { describe, expect, test } from "bun:test";

import type { VoiceTranscript } from "../channels/index.ts";
import { OpenAiRealtimeVoiceAgent } from "./openai-realtime-client.ts";

interface OpenAiRealtimeVoiceAgentTestHandle {
  handleRawMessage(data: unknown): Promise<void>;
}

function newRealtimeAgent(): OpenAiRealtimeVoiceAgent {
  return new OpenAiRealtimeVoiceAgent({
    apiKey: "test-api-key",
    session: {
      inputAudioFormat: "audio/pcm",
      instructions: "Test instructions",
      model: "test-model",
      outputAudioFormat: "audio/pcm",
      tools: [],
      turnDetection: {
        type: "server_vad",
      },
      voice: "test-voice",
    },
  });
}

function testHandle(agent: OpenAiRealtimeVoiceAgent): OpenAiRealtimeVoiceAgentTestHandle {
  return agent as unknown as OpenAiRealtimeVoiceAgentTestHandle;
}

describe("OpenAiRealtimeVoiceAgent", () => {
  test("deduplicates final assistant transcripts emitted as audio and text events", async () => {
    const agent = newRealtimeAgent();
    const transcripts: VoiceTranscript[] = [];

    agent.onTranscript((transcript) => {
      transcripts.push(transcript);
    });

    await testHandle(agent).handleRawMessage(
      JSON.stringify({
        item_id: "item-1",
        transcript: "Ola, eu sou a Clara. Como posso ajudar?",
        type: "response.output_audio_transcript.done",
      }),
    );
    await testHandle(agent).handleRawMessage(
      JSON.stringify({
        item_id: "item-1",
        text: "Ola, eu sou a Clara. Como posso ajudar?",
        type: "response.output_text.done",
      }),
    );

    expect(transcripts).toEqual([
      {
        partial: false,
        role: "assistant",
        text: "Ola, eu sou a Clara. Como posso ajudar?",
      },
    ]);
  });
});
