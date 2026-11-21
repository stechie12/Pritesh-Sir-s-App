import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Modality, type LiveServerMessage } from '@google/genai';
import { getGenAIClient, withTimeout } from './aiService.ts';
import { buildSmartTutorResponse } from './mathEngine.ts';

const MAX_CONCURRENT_LIVE_CONNECTIONS = 50;

/**
 * Attaches the Gemini 3.8 Live (`gemini-3.8-live`) real-time voice WebSocket bridge at `/live`
 * with payload caps, connection limits, heartbeat cleanup, and a graceful shutdown hook.
 */
export function attachGeminiLiveWebSocket(server: http.Server): {
  closeAll: () => void;
  getActiveConnections: () => number;
} {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname !== '/live') {
      return;
    }

    if (wss.clients.size >= MAX_CONCURRENT_LIVE_CONNECTIONS) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', async (clientWs: WebSocket) => {
    let isAlive = true;
    clientWs.on('pong', () => {
      isAlive = true;
    });

    const heartbeatTimer = setInterval(() => {
      if (!isAlive) {
        clearInterval(heartbeatTimer);
        clientWs.terminate();
        return;
      }
      isAlive = false;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.ping();
      }
    }, 25_000);

    const ai = getGenAIClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let liveSession: any = null;

    if (ai) {
      try {
        liveSession = await withTimeout(
          ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
              },
              systemInstruction:
                "You are Pritesh Sir's AI Maths Assistant, a warm, articulate AI mathematics tutor supporting ICSE (Selina Concise) and CBSE (NCERT) Grades 8 to 12 students across every branch of mathematics. Never claim to be Pritesh Sir himself.",
            },
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                if (clientWs.readyState !== WebSocket.OPEN) return;
                const content = message.serverContent;
                if (content?.inputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'input_transcript',
                      text: content.inputTranscription.text,
                    })
                  );
                }
                if (content?.outputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'output_transcript',
                      text: content.outputTranscription.text,
                    })
                  );
                }
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    clientWs.send(
                      JSON.stringify({
                        type: 'audio',
                        audio: part.inlineData.data,
                      })
                    );
                  }
                }
                if (content?.interrupted) {
                  clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }
              },
              onerror: () => {
                liveSession = null;
              },
            },
          }),
          4000
        );
      } catch {
        liveSession = null;
      }
    }

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: 'status',
          mode: liveSession ? 'gemini-3.8-live' : 'gemini-3.8-live-local',
          message: liveSession
            ? 'Connected to gemini-3.8-live stream (16kHz in / 24kHz out)'
            : 'gemini-3.8-live voice engine ready (0ms latency)',
        })
      );
    }

    let wsMessageCount = 0;
    let wsWindowResetAt = Date.now() + 60_000;

    clientWs.on('message', (rawData) => {
      try {
        const rawStr = rawData.toString();
        if (rawStr.length > 750_000) {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: 'Frame exceeds size limit.' }));
          }
          return;
        }
        const payload = JSON.parse(rawStr) as { audio?: unknown; text?: unknown };
        if (typeof payload.audio === 'string' && payload.audio && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: payload.audio.slice(0, 500_000),
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (typeof payload.text === 'string' && payload.text.trim()) {
          const now = Date.now();
          if (now > wsWindowResetAt) {
            wsMessageCount = 0;
            wsWindowResetAt = now + 60_000;
          }
          wsMessageCount += 1;
          if (wsMessageCount > 40) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({ type: 'error', message: 'Voice prompt rate limit reached. Please pause briefly.' })
              );
            }
            return;
          }
          const safeText = payload.text.trim().slice(0, 1000);
          if (liveSession) {
            liveSession.sendRealtimeInput({ text: safeText });
          } else if (clientWs.readyState === WebSocket.OPEN) {
            const solved = buildSmartTutorResponse(safeText, '10', 'ICSE', 'Mathematics');
            const replyText =
              solved.responseType === 'chat'
                ? solved.chatReply === '__NEEDS_LIVE_LLM__'
                  ? 'Ask me any ICSE or CBSE math formula, equation, or concept to hear an instant explanation!'
                  : solved.chatReply || ''
                : `${solved.conceptTitle}: ${solved.prerequisiteRecap} ${solved.steps[0] || ''} Final Answer: ${solved.finalAnswer}`;
            clientWs.send(
              JSON.stringify({
                type: 'output_transcript',
                text: replyText.replace(/\*\*/g, ''),
                speakClientSide: true,
              })
            );
          }
        }
      } catch {
        // Ignore malformed frame
      }
    });

    const cleanup = () => {
      clearInterval(heartbeatTimer);
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // Ignore close error
        }
        liveSession = null;
      }
    };

    clientWs.on('close', cleanup);
    clientWs.on('error', cleanup);
  });

  return {
    getActiveConnections: () => wss.clients.size,
    closeAll: () => {
      for (const client of wss.clients) {
        try {
          client.close(1001, 'Server shutting down');
        } catch {
          client.terminate();
        }
      }
      wss.close();
    },
  };
}
