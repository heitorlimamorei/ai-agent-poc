import { Hono } from "hono";

import { sellerVoiceWebSocketPath } from "./voice.ts";

export const sellerVoicePlaygroundPath = "/voice/seller";

const sellerVoicePlaygroundHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Seller Voice Console</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe6;
        --panel: rgba(255, 251, 245, 0.84);
        --panel-strong: rgba(255, 248, 240, 0.96);
        --line: rgba(64, 45, 28, 0.12);
        --text: #2b2218;
        --muted: #6b5a49;
        --accent: #b6542f;
        --accent-strong: #8f3f21;
        --accent-soft: #f3d4bf;
        --success: #2f7d4a;
        --danger: #9c2f2f;
        --shadow: 0 18px 48px rgba(70, 44, 19, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(255, 255, 255, 0.6), transparent 34%),
          radial-gradient(circle at bottom right, rgba(182, 84, 47, 0.12), transparent 32%),
          linear-gradient(135deg, #f7f0e6 0%, #efe4d3 52%, #e8dac8 100%);
      }

      .shell {
        width: min(1080px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 32px 0 40px;
      }

      .hero {
        display: grid;
        gap: 18px;
        margin-bottom: 24px;
      }

      .eyebrow {
        margin: 0;
        font-size: 0.76rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: var(--accent-strong);
      }

      h1 {
        margin: 0;
        max-width: 12ch;
        font-size: clamp(2.5rem, 5vw, 5rem);
        line-height: 0.95;
        font-weight: 700;
      }

      .hero p {
        margin: 0;
        max-width: 62ch;
        color: var(--muted);
        font-size: 1.04rem;
      }

      .grid {
        display: grid;
        gap: 20px;
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
      }

      .panel {
        border: 1px solid var(--line);
        background: var(--panel);
        backdrop-filter: blur(18px);
        border-radius: 24px;
        box-shadow: var(--shadow);
      }

      .panel.main {
        padding: 24px;
      }

      .panel.side {
        padding: 20px;
      }

      .status-card {
        display: grid;
        gap: 10px;
        padding: 16px 18px;
        border-radius: 18px;
        background: var(--panel-strong);
        border: 1px solid var(--line);
      }

      .status-row {
        display: flex;
        gap: 12px;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent-strong);
        font-size: 0.92rem;
      }

      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: currentColor;
        opacity: 0.9;
      }

      .status-dot.live {
        color: var(--success);
        animation: pulse 1.2s infinite;
      }

      @keyframes pulse {
        0% { transform: scale(0.92); opacity: 0.7; }
        70% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(0.92); opacity: 0.7; }
      }

      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        font: inherit;
        cursor: pointer;
        transition: transform 160ms ease, opacity 160ms ease, background 160ms ease;
      }

      button:hover:not(:disabled) {
        transform: translateY(-1px);
      }

      button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .button-primary {
        background: var(--accent);
        color: #fff9f2;
      }

      .button-secondary {
        background: rgba(43, 34, 24, 0.08);
        color: var(--text);
      }

      .button-danger {
        background: rgba(156, 47, 47, 0.12);
        color: var(--danger);
      }

      .button-live {
        background: rgba(47, 125, 74, 0.14);
        color: var(--success);
      }

      .meter {
        position: relative;
        height: 12px;
        margin-top: 18px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(43, 34, 24, 0.08);
      }

      .meter > span {
        position: absolute;
        inset: 0 auto 0 0;
        width: 0%;
        border-radius: inherit;
        background: linear-gradient(90deg, #ef9f73 0%, #b6542f 100%);
        transition: width 120ms linear;
      }

      .transcript-list {
        display: grid;
        gap: 12px;
        margin-top: 18px;
      }

      .bubble {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
      }

      .bubble.user {
        background: rgba(182, 84, 47, 0.1);
      }

      .bubble.assistant {
        background: rgba(255, 255, 255, 0.64);
      }

      .bubble small {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.68rem;
      }

      .partial {
        min-height: 60px;
        margin-top: 18px;
        padding: 14px 16px;
        border: 1px dashed rgba(64, 45, 28, 0.2);
        border-radius: 18px;
        color: var(--muted);
      }

      .log {
        margin-top: 18px;
        padding: 14px;
        border-radius: 16px;
        background: rgba(43, 34, 24, 0.05);
        max-height: 260px;
        overflow: auto;
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 0.86rem;
        white-space: pre-wrap;
      }

      .facts {
        display: grid;
        gap: 14px;
      }

      .fact {
        padding: 14px 16px;
        border-radius: 18px;
        background: var(--panel-strong);
        border: 1px solid var(--line);
      }

      .fact strong {
        display: block;
        margin-bottom: 8px;
        font-size: 0.86rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      code {
        font-family: "SFMono-Regular", Consolas, monospace;
        font-size: 0.92em;
      }

      @media (max-width: 920px) {
        .grid {
          grid-template-columns: 1fr;
        }

        h1 {
          max-width: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">Voice seller playground</p>
        <h1>Converse com o agente de vendas.</h1>
        <p>
          Esta tela abre um WebSocket direto com o fluxo de voz do vendedor, envia audio PCM do microfone,
          reproduz a resposta sintetizada e mostra as transcricoes dos dois lados da conversa.
        </p>
      </section>

      <section class="grid">
        <section class="panel main">
          <div class="status-card">
            <div class="status-row">
              <div class="status-pill">
                <span id="status-dot" class="status-dot"></span>
                <span id="status-label">Desconectado</span>
              </div>
              <div id="session-id">Sessao: aguardando</div>
            </div>
            <div id="status-detail">Clique em conectar para iniciar a sessao de voz.</div>
          </div>

          <div class="controls">
            <button id="connect-button" class="button-primary">Conectar</button>
            <button id="record-button" class="button-live" disabled>Gravar</button>
            <button id="interrupt-button" class="button-secondary" disabled>Interromper resposta</button>
            <button id="disconnect-button" class="button-danger" disabled>Encerrar</button>
          </div>

          <div class="meter" aria-hidden="true">
            <span id="level-meter"></span>
          </div>

          <div id="partial-transcript" class="partial">Nenhuma transcricao parcial ainda.</div>
          <div id="transcript-list" class="transcript-list"></div>
          <pre id="log" class="log">[ui] pronto</pre>
        </section>

        <aside class="panel side">
          <div class="facts">
            <div class="fact">
              <strong>Fluxo</strong>
              <span>Conectar e falar normalmente. A tela detecta voz, envia o turno sozinha e simula uma chamada ativa.</span>
            </div>
            <div class="fact">
              <strong>WebSocket</strong>
              <span><code>${sellerVoiceWebSocketPath}?format=audio/pcm</code></span>
            </div>
            <div class="fact">
              <strong>Formato</strong>
              <span>Entrada e saida em PCM mono, 24 kHz, 16 bits.</span>
            </div>
          </div>
        </aside>
      </section>
    </main>

    <script>
      const wsPath = "${sellerVoiceWebSocketPath}?format=audio/pcm";
      const connectButton = document.getElementById("connect-button");
      const recordButton = document.getElementById("record-button");
      const interruptButton = document.getElementById("interrupt-button");
      const disconnectButton = document.getElementById("disconnect-button");
      const statusDot = document.getElementById("status-dot");
      const statusLabel = document.getElementById("status-label");
      const statusDetail = document.getElementById("status-detail");
      const sessionId = document.getElementById("session-id");
      const partialTranscript = document.getElementById("partial-transcript");
      const transcriptList = document.getElementById("transcript-list");
      const logEl = document.getElementById("log");
      const levelMeter = document.getElementById("level-meter");

      let socket;
      let audioContext;
      let mediaStream;
      let mediaSource;
      let processor;
      let monitorGain;
      let isMicrophoneMuted = false;
      let isTurnActive = false;
      let isAssistantSpeaking = false;
      let playbackCursor = 0;
      let partialAssistant = "";
      let partialUser = "";
      let playbackSources = [];
      let hasBufferedAudio = false;
      let silenceTimeoutId;
      let speechFrameCount = 0;

      const speechStartFrameThreshold = 3;
      const speechThreshold = 0.045;
      const silenceCommitDelayMs = 1100;

      function log(message) {
        const time = new Date().toLocaleTimeString();
        logEl.textContent = "[" + time + "] " + message + "\\n" + logEl.textContent;
      }

      function setStatus(label, detail, state) {
        statusLabel.textContent = label;
        statusDetail.textContent = detail;
        statusDot.className = state === "live" ? "status-dot live" : "status-dot";
        if (state === "error") {
          statusDot.style.color = "var(--danger)";
        } else if (state === "live") {
          statusDot.style.color = "var(--success)";
        } else {
          statusDot.style.color = "var(--accent-strong)";
        }
      }

      function updateButtons() {
        const connected = socket && socket.readyState === WebSocket.OPEN;
        connectButton.disabled = connected;
        recordButton.disabled = !connected;
        interruptButton.disabled = !connected;
        disconnectButton.disabled = !connected;
        recordButton.textContent = isMicrophoneMuted ? "Retomar microfone" : "Mutar microfone";
      }

      function clearSilenceTimeout() {
        if (silenceTimeoutId === undefined) {
          return;
        }

        clearTimeout(silenceTimeoutId);
        silenceTimeoutId = undefined;
      }

      function clearAssistantPlayback() {
        for (const source of playbackSources) {
          try {
            source.stop();
          } catch (_error) {
          }

          source.disconnect();
        }

        playbackSources = [];
        playbackCursor = 0;
        isAssistantSpeaking = false;
      }

      function commitDetectedTurn() {
        clearSilenceTimeout();

        if (!hasBufferedAudio) {
          isTurnActive = false;
          return;
        }

        sendJson({
          event: { type: "commit" },
          type: "control",
        });
        hasBufferedAudio = false;
        isTurnActive = false;
        speechFrameCount = 0;
        setStatus("Aguardando resposta", "Turno detectado automaticamente. Aguardando a assistente responder.", "live");
        log("turno enviado automaticamente");
      }

      function interruptAssistant(reason) {
        if (!isAssistantSpeaking && playbackSources.length === 0) {
          return;
        }

        clearAssistantPlayback();
        sendJson({
          event: { type: "interrupt" },
          type: "control",
        });
        log(reason);
      }

      function appendTranscript(role, text) {
        const bubble = document.createElement("article");
        bubble.className = "bubble " + role;

        const label = document.createElement("small");
        label.textContent = role === "assistant" ? "Agente" : "Cliente";

        const body = document.createElement("div");
        body.textContent = text;

        bubble.append(label, body);
        transcriptList.prepend(bubble);
      }

      function refreshPartial() {
        const parts = [];

        if (partialUser) {
          parts.push("Cliente: " + partialUser);
        }

        if (partialAssistant) {
          parts.push("Agente: " + partialAssistant);
        }

        partialTranscript.textContent = parts.length > 0 ? parts.join("\\n") : "Nenhuma transcricao parcial ainda.";
      }

      function ensureAudioContext() {
        if (!audioContext) {
          audioContext = new AudioContext({ sampleRate: 24000 });
        }

        if (audioContext.state === "suspended") {
          return audioContext.resume().then(() => audioContext);
        }

        return Promise.resolve(audioContext);
      }

      function encodePcm16Base64(float32Array) {
        const pcmBytes = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(pcmBytes);

        for (let index = 0; index < float32Array.length; index += 1) {
          const sample = Math.max(-1, Math.min(1, float32Array[index]));
          view.setInt16(index * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
        }

        const bytes = new Uint8Array(pcmBytes);
        let binary = "";
        const chunkSize = 8192;

        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          const chunk = bytes.subarray(offset, offset + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }

        return btoa(binary);
      }

      function decodePcm16Base64(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }

        const view = new DataView(bytes.buffer);
        const float32 = new Float32Array(bytes.byteLength / 2);

        for (let index = 0; index < float32.length; index += 1) {
          float32[index] = view.getInt16(index * 2, true) / 32768;
        }

        return float32;
      }

      async function playPcmChunk(base64) {
        const context = await ensureAudioContext();
        const samples = decodePcm16Base64(base64);
        const buffer = context.createBuffer(1, samples.length, 24000);
        buffer.copyToChannel(samples, 0);

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => {
          playbackSources = playbackSources.filter((currentSource) => currentSource !== source);

          if (playbackSources.length === 0) {
            isAssistantSpeaking = false;
          }
        };

        const startAt = Math.max(context.currentTime + 0.02, playbackCursor || 0);
        isAssistantSpeaking = true;
        playbackSources.push(source);
        source.start(startAt);
        playbackCursor = startAt + buffer.duration;
      }

      function sendJson(value) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          return;
        }

        socket.send(JSON.stringify(value));
      }

      async function startRecording() {
        if (processor) {
          return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Navegador não suporta a API de áudio ou a página não foi carregada em contexto seguro (HTTPS ou localhost).");
        }

        const context = await ensureAudioContext();
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            autoGainControl: false,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        mediaSource = context.createMediaStreamSource(mediaStream);
        processor = context.createScriptProcessor(4096, 1, 1);
        monitorGain = context.createGain();
        monitorGain.gain.value = 0;

        processor.onaudioprocess = (event) => {
          if (isMicrophoneMuted) {
            return;
          }

          const input = event.inputBuffer.getChannelData(0);
          let peak = 0;

          for (let index = 0; index < input.length; index += 1) {
            peak = Math.max(peak, Math.abs(input[index]));
          }

          levelMeter.style.width = Math.min(100, Math.round(peak * 180)).toString() + "%";

          if (peak < speechThreshold) {
            speechFrameCount = 0;

            if (isTurnActive && silenceTimeoutId === undefined) {
              silenceTimeoutId = setTimeout(() => {
                commitDetectedTurn();
              }, silenceCommitDelayMs);
            }

            return;
          }

          clearSilenceTimeout();
          speechFrameCount += 1;

          if (!isTurnActive && speechFrameCount < speechStartFrameThreshold) {
            return;
          }

          if (!isTurnActive) {
            isTurnActive = true;
            interruptAssistant("resposta interrompida por nova fala do usuario");
            setStatus("Ouvindo", "Ligacao ativa. Fale normalmente que o turno sera detectado automaticamente.", "live");
          }

          hasBufferedAudio = true;

          sendJson({
            format: "audio/pcm",
            payload: encodePcm16Base64(input),
            type: "audio",
          });
        };

        mediaSource.connect(processor);
        processor.connect(monitorGain);
        monitorGain.connect(context.destination);
        isMicrophoneMuted = false;
        setStatus("Ligacao ativa", "Microfone aberto. Fale como se estivesse em uma chamada telefonica.", "live");
        log("microfone conectado em modo de ligacao");
        updateButtons();
      }

      function stopRecording(sendCommit) {
        clearSilenceTimeout();

        if (processor) {
          processor.disconnect();
          processor.onaudioprocess = null;
          processor = undefined;
        }

        if (mediaSource) {
          mediaSource.disconnect();
          mediaSource = undefined;
        }

        if (monitorGain) {
          monitorGain.disconnect();
          monitorGain = undefined;
        }

        if (mediaStream) {
          for (const track of mediaStream.getTracks()) {
            track.stop();
          }

          mediaStream = undefined;
        }

        levelMeter.style.width = "0%";
        isTurnActive = false;
        hasBufferedAudio = false;
        isMicrophoneMuted = false;
        speechFrameCount = 0;
        updateButtons();

        if (sendCommit) {
          commitDetectedTurn();
        }
      }

      function toggleMute() {
        if (!processor) {
          return;
        }

        isMicrophoneMuted = !isMicrophoneMuted;

        if (isMicrophoneMuted) {
          clearSilenceTimeout();
          isTurnActive = false;
          hasBufferedAudio = false;
          speechFrameCount = 0;
          levelMeter.style.width = "0%";
          setStatus("Microfone mutado", "A ligacao segue ativa, mas o microfone local nao esta enviando audio.", "live");
          log("microfone mutado");
        } else {
          setStatus("Ligacao ativa", "Microfone reativado. Fale normalmente para enviar um novo turno.", "live");
          log("microfone reativado");
        }

        updateButtons();
      }

      function disconnect(notifyServer = true) {
        stopRecording(false);
        clearAssistantPlayback();

        if (socket) {
          if (notifyServer) {
            sendJson({
              event: { type: "stop" },
              type: "control",
            });
          }
          socket.close();
          socket = undefined;
        }

        playbackCursor = 0;
        sessionId.textContent = "Sessao: aguardando";
        setStatus("Desconectado", "Clique em conectar para iniciar a sessao de voz.", "idle");
        updateButtons();
      }

      async function connect() {
        if (
          socket &&
          (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)
        ) {
          return;
        }

        await ensureAudioContext();

        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        socket = new WebSocket(protocol + "//" + window.location.host + wsPath);

        socket.addEventListener("open", () => {
          setStatus("Conectando chamada", "Sessao aberta. Preparando o canal de voz continuo.", "live");
          log("websocket conectado");
          sendJson({
            event: {
              metadata: { source: "voice-playground-web" },
              type: "start",
            },
            type: "control",
          });
          updateButtons();
        });

        socket.addEventListener("close", () => {
          log("websocket encerrado");
          stopRecording(false);
          clearAssistantPlayback();
          socket = undefined;
          playbackCursor = 0;
          setStatus("Desconectado", "A sessao foi encerrada.", "idle");
          updateButtons();
        });

        socket.addEventListener("error", () => {
          log("falha no websocket");
          setStatus("Erro", "Falha de comunicacao com a sessao de voz.", "error");
        });

        socket.addEventListener("message", async (event) => {
          const message = JSON.parse(event.data);

          if (message.type === "audio") {
            await playPcmChunk(message.payload);
            return;
          }

          if (message.type === "transcript") {
            if (message.partial) {
              if (message.role === "assistant") {
                partialAssistant += message.text;
              } else {
                partialUser += message.text;
              }

              refreshPartial();
              return;
            }

            if (message.role === "assistant") {
              partialAssistant = "";
            } else {
              partialUser = "";
            }

            refreshPartial();
            appendTranscript(message.role, message.text);
            return;
          }

          if (message.type === "control") {
            const control = message.event;

            if (control.type === "ready") {
              sessionId.textContent = "Sessao: " + control.sessionId;
              log("sessao pronta: " + control.sessionId);
              startRecording().catch((error) => {
                const message = error instanceof Error ? error.message : "Falha ao abrir o microfone";
                log("erro no microfone: " + message);
                setStatus("Erro", message, "error");
              });
              return;
            }

            if (control.type === "error") {
              log("erro: " + control.message);
              setStatus("Erro", control.message, "error");
              return;
            }

            if (control.type === "stop") {
              const reason = control.reason ?? "A assistente encerrou a chamada.";
              log(reason);
              setStatus("Encerrando", reason, "idle");
              disconnect(false);
              return;
            }
          }
        });
      }

      connectButton.addEventListener("click", () => {
        connect().catch((error) => {
          const message = error instanceof Error ? error.message : "Falha ao conectar";
          log("erro ao conectar: " + message);
          setStatus("Erro", message, "error");
        });
      });

      recordButton.addEventListener("click", () => {
        toggleMute();
      });

      interruptButton.addEventListener("click", () => {
        interruptAssistant("resposta interrompida");
      });

      disconnectButton.addEventListener("click", disconnect);
      updateButtons();
    </script>
  </body>
</html>`;

export function NewSellerVoicePlaygroundRouter(): Hono {
  const app = new Hono();

  app.get(sellerVoicePlaygroundPath, (context) =>
    context.html(sellerVoicePlaygroundHtml, 200, {
      "Cache-Control": "no-store",
    }),
  );

  return app;
}
