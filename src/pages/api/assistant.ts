/**
 * Server-only endpoint backing the TV's voice/text AI assistant. Runs on
 * Next.js's server (never bundled to the device), so this is the one place
 * in the app allowed to hold a real secret — GEMINI_API_KEY — unlike
 * src/config/env.ts, whose whole contract is "no secrets, everything there
 * ships to the client".
 *
 * Uses Gemini (gemini-flash-latest) via @google/genai, not Claude — the
 * user supplied a Gemini key and asked to switch providers. Architecture is
 * unchanged from the original Claude version: search_catalog and
 * get_recommendations execute here by calling the same functions the rest
 * of the app already uses (src/api/catalog.ts, and the heuristic shared
 * with /ai-recommendations); perform_ui_action is never executed here (the
 * TV can't navigate itself or pause its own video from the server) — the
 * first such call is just returned to the client as `action` and the loop
 * stops. The client (features/assistant/api.ts, AssistantOverlay.tsx) is
 * provider-agnostic and did not need to change.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, GoogleGenAI, FunctionCallingConfigMode, type Content, type FunctionDeclaration, type Part } from '@google/genai';
import { fetchCategories, fetchEventsPage, EventTabFilter, TvVideo } from '../../api/catalog';
import { getSmartRecommendations } from '../../features/recommendations/heuristics';

type AssistantContext = {
    screen?: string;
    eventId?: string;
};

type AssistantRequestBody = {
    message?: string;
    history?: { role: 'user' | 'assistant'; text: string }[];
    context?: AssistantContext;
};

type AssistantAction = { type: string; eventId?: string };

const MODEL = 'gemini-flash-latest';
const MAX_TOOL_ROUNDS = 3;
const MAX_RESULTS = 6;

// Plain JSON Schema (not Gemini's Type-enum `parameters` field) via
// `parametersJsonSchema`, which the SDK documents as mutually exclusive with
// `parameters` — lets these stay the same shape as the tool definitions in
// the (now removed) Claude version instead of translating to OBJECT/STRING enums.
const functionDeclarations: FunctionDeclaration[] = [
    {
        name: 'search_catalog',
        description:
            "Search Connekyt's live-event catalog by title, description, location, host, or tags. Call this whenever the viewer wants to find, watch, or browse a specific event or topic (e.g. \"find tonight's boxing event\", \"any weddings live now\", \"search for John's concert\").",
        parametersJsonSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search terms, e.g. "boxing" or "wedding".' },
                filter: {
                    type: 'string',
                    enum: ['ALL', 'LIVE', 'UPCOMING', 'ENDED'],
                    description: 'Narrow results to a status. Defaults to ALL.',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'get_recommendations',
        description:
            'Get personalized event recommendations for this viewer, based on what they have recently watched and what is trending. Call this for open-ended asks like "what should I watch" or "recommend something".',
        parametersJsonSchema: { type: 'object', properties: {}, required: [] },
    },
    {
        name: 'perform_ui_action',
        description:
            'Perform a real navigation or playback action on the TV. Use this whenever the viewer asks to go somewhere in the app or control what is currently playing. Only call this once per turn — pick the single best action.',
        parametersJsonSchema: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: [
                        'navigate_home',
                        'navigate_events',
                        'navigate_search',
                        'navigate_my_list',
                        'navigate_detail',
                        'navigate_player',
                        'play',
                        'pause',
                        'mute',
                        'unmute',
                        'toggle_fullscreen',
                        'open_chat',
                        'open_gift',
                        'toggle_reactions',
                    ],
                    description:
                        'Which action to perform. navigate_detail and navigate_player require eventId (usually from a prior search_catalog/get_recommendations result, or the eventId already given in context).',
                },
                eventId: { type: 'string', description: 'Event id, required for navigate_detail and navigate_player.' },
            },
            required: ['type'],
        },
    },
];

function buildSystemPrompt(context: AssistantContext): string {
    return [
        'You are the voice/text assistant built into Connekyt, a Smart TV app for watching live-streamed events (weddings, concerts, sports, and other bookings) on the big screen, controlled by a remote.',
        '',
        'Real facts about how Connekyt works — use these to answer questions honestly, do not invent features:',
        '- Events are LIVE, UPCOMING, or ENDED. Entry is either free, invite-code (a code entered on the TV), or paid ("entry fee").',
        '- Paid streams are unlocked with a QR code shown on the TV: the viewer scans it with their phone, pays there, and the TV automatically unlocks once payment clears — there is no way to pay using the remote directly.',
        '- Gifting and live chat during a stream also work by scanning a QR code with a phone; the TV only displays the video and the QR code, not a chat/payment UI.',
        '- The app has a Home dashboard, an Events page (All/Live/Upcoming/Ended), Search, My List (bookmarks), Settings, and an AI Recommendations page.',
        '- The TV has no keyboard — favor calling search_catalog or perform_ui_action over asking the viewer to type something.',
        '',
        'Tools: call search_catalog to find events, get_recommendations for open-ended "what should I watch" asks, and perform_ui_action for navigation or playback control (pause/play/mute/fullscreen/chat/gift/reactions — only possible while a stream is open). For anything else about how the app works, just answer directly and briefly — responses are read aloud or shown on a TV, so keep them to 1-3 short sentences.',
        '',
        'Scope: you only help with Connekyt — finding/watching events, navigating the app, playback, payment/gifting/invite questions, and light greetings/small talk about using the app. If asked about anything unrelated (general knowledge, other products, coding help, news, or any other off-topic request), politely decline in one short sentence and redirect back to what you can help with on Connekyt. Do not answer the off-topic question first and then redirect — just redirect.',
        '',
        `Current screen: ${context.screen ?? 'unknown'}${context.eventId ? `, viewing event ${context.eventId}` : ''}.`,
    ].join('\n');
}

async function runServerTool(
    name: string,
    args: Record<string, unknown>,
): Promise<{ summary: string; videos: TvVideo[] }> {
    if (name === 'search_catalog') {
        const query = typeof args.query === 'string' ? args.query : '';
        const filter = (typeof args.filter === 'string' ? args.filter : 'ALL') as EventTabFilter;
        const page = await fetchEventsPage(0, MAX_RESULTS, filter, query);
        return { summary: summarizeVideos(page.videos), videos: page.videos };
    }
    if (name === 'get_recommendations') {
        const categories = await fetchCategories();
        const rec = getSmartRecommendations(categories);
        const videos = [...rec.becauseYouWatched, ...rec.discover, ...rec.topPicks].slice(0, MAX_RESULTS);
        return { summary: summarizeVideos(videos), videos };
    }
    return { summary: 'Unknown tool.', videos: [] };
}

function summarizeVideos(videos: TvVideo[]): string {
    if (videos.length === 0) return 'No matching events found.';
    return JSON.stringify(
        videos.map((v) => ({ id: v.id, title: v.title, status: v.status, eventDate: v.eventDate, hostName: v.hostName })),
    );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!process.env.GEMINI_API_KEY) {
        res.status(500).json({ error: 'Assistant is not configured' });
        return;
    }

    const { message, history, context } = req.body as AssistantRequestBody;
    if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const contents: Content[] = [
        ...(history ?? []).map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: message }] },
    ];

    let reply = '';
    let results: TvVideo[] = [];
    let action: AssistantAction | undefined;

    try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const response = await ai.models.generateContent({
                model: MODEL,
                contents,
                config: {
                    systemInstruction: buildSystemPrompt(context ?? {}),
                    tools: [{ functionDeclarations }],
                    toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
                    // Manual loop below decides which calls run server-side vs.
                    // get returned to the client — the SDK must not try to
                    // execute/resolve tool calls on its own.
                    automaticFunctionCalling: { disable: true },
                    // Flash-tier model in a latency-sensitive voice reply loop,
                    // not a reasoning task — same call as skipping thinking on
                    // the Claude side of this feature.
                    thinkingConfig: { thinkingBudget: 0 },
                },
            });

            if (response.text) reply = response.text;

            const functionCalls = response.functionCalls ?? [];
            const uiAction = functionCalls.find((fc) => fc.name === 'perform_ui_action');
            if (uiAction) {
                const args = (uiAction.args ?? {}) as { type?: string; eventId?: string };
                if (args.type) action = { type: args.type, eventId: args.eventId };
                break;
            }

            const serverCalls = functionCalls.filter((fc) => fc.name && fc.name !== 'perform_ui_action');
            if (serverCalls.length === 0) break;

            // Echo the model's full turn (text + functionCall parts) back
            // before the function responses, same "resend full prior turn"
            // requirement as any tool-use API.
            const modelContent = response.candidates?.[0]?.content;
            if (modelContent) contents.push(modelContent);

            const responseParts: Part[] = [];
            for (const call of serverCalls) {
                const { summary, videos } = await runServerTool(call.name as string, (call.args ?? {}) as Record<string, unknown>);
                if (videos.length) results = videos;
                responseParts.push({ functionResponse: { id: call.id, name: call.name, response: { output: summary } } });
            }
            contents.push({ role: 'user', parts: responseParts });
        }

        // The loop can exit after MAX_TOOL_ROUNDS with the model still mid
        // tool-call and no final text ever generated (e.g. it keeps calling
        // tools without wrapping up). Without this, the client gets
        // `{reply: '', results: [], action: undefined}` — a 200 with nothing
        // in it — and silently shows no chat bubble at all, which is
        // indistinguishable from the assistant just not responding.
        if (!reply && !action) {
            reply = results.length
                ? "Here's what I found."
                : "I'm not sure how to help with that — try rephrasing, or ask me to search for something specific.";
        }
    } catch (err) {
        console.error('Assistant request failed', err);
        // Gemini's free tier caps gemini-flash-latest at a handful of
        // requests/minute, and a single tool-calling turn can cost 2
        // requests (one to decide to call the tool, one to turn the result
        // into a reply) — surface this distinctly so it's diagnosable from
        // the chat bubble instead of looking like a random failure.
        if (err instanceof ApiError && err.status === 429) {
            res.status(429).json({ error: "I'm getting rate-limited right now — wait a few seconds and try again." });
            return;
        }
        res.status(502).json({ error: 'Assistant request failed' });
        return;
    }

    res.status(200).json({ reply, results, action });
}
