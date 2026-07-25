/**
 * Client for smartTv's own /api/assistant route (not amoria-connect, so this
 * deliberately doesn't go through src/api/client.ts — same-origin, no auth
 * token, no base-URL prefix).
 */
import type { TvVideo } from '../../api/catalog';
import type { AssistantAction, AssistantMessage } from '../../store/assistant';

export type AssistantContext = {
    screen: string;
    eventId?: string;
};

export type AssistantResponse = {
    reply: string;
    results: TvVideo[];
    action?: AssistantAction;
};

// The route can run up to 3 sequential Gemini calls in a tool-calling turn,
// so this needs more headroom than a typical single-request timeout — but it
// still needs a cap, since without one a hung request leaves the overlay's
// `loading` state (and its spinner) stuck forever with no way out short of
// closing the panel. See src/config/env.ts's requestTimeoutMs for the
// equivalent bound on calls to amoria-connect.
const REQUEST_TIMEOUT_MS = 25_000;

export async function askAssistant(
    message: string,
    history: AssistantMessage[],
    context: AssistantContext,
): Promise<AssistantResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
        res = await fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: history.map((m) => ({ role: m.role, text: m.text })),
                context,
            }),
            signal: controller.signal,
        });
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error('That took too long to answer — try again.');
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }

    if (!res.ok) {
        // Surface the server's actual error ("Assistant is not configured",
        // etc.) instead of a generic message — the overlay shows this
        // directly, so a misconfigured key or a Gemini-side failure is
        // diagnosable from the chat bubble instead of being indistinguishable
        // from "no network at all".
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Assistant request failed (${res.status})`);
    }

    const data = (await res.json()) as AssistantResponse;
    return { reply: data.reply ?? '', results: data.results ?? [], action: data.action };
}
