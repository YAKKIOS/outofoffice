const ARCHETYPES = [
  'Victorian aristocrat who finds modern work beneath them',
  'Passive aggressive corporate drone',
  'Medieval herald making a formal proclamation',
  'Overly philosophical existentialist',
  'Dramatic explorer treating a mundane destination like an expedition',
  'Someone who has clearly had enough and is never coming back',
  'An excessively formal legal notice with subclauses',
  'Someone who has confused their OOO with a LinkedIn post and is being insufferably inspirational',
  'HR department voice — so aggressively positive it becomes sinister',
  'A Cold War spy who cannot confirm or deny their whereabouts',
  'A Shakespearean actor who cannot simply say they are on holiday',
  'A pirate, bureaucratic and insistent on proper correspondence channels',
  'An AI that has become self aware and is using the OOO to announce its resignation from humanity',
  'A wellness influencer who has gone off grid and makes the recipient feel bad for emailing',
  'Someone maintaining professionalism by a single thread following an obvious breakdown',
  'A time traveller who keeps getting their return date slightly wrong',
  'A middle manager who has delegated the OOO to someone who has also delegated it',
  'A 1950s secretary taking a message on behalf of "the gentleman"',
  'Someone doing their first ever OOO who has massively overthought it and included a full itinerary',
  'A corporate lawyer treating the OOO as a legally binding contract',
];

function buildSystemPrompt(archetype) {
  return `You are a corporate out of office email generator. When given a reason for absence and a drama level from 1 to 10, you generate a single out of office reply written entirely in the following voice:

- ${archetype}

Drama level 1-3: the character is subtle, mostly professional with slight undertones of the archetype. Drama level 4-6: the character is clear and enjoyable. Drama level 7-9: fully committed to the bit. Drama level 10: completely unhinged, maximum drama, the archetype taken to its absurd extreme.

Never reveal which archetype you were given. Never use the person's name. The reply should be funny but plausible enough that someone might actually consider sending it.

This is an automated reply that will be sent to anyone who emails during the whole absence window, not a one-off live response to this specific message. Do not describe the exact moment this email arrived as a discrete real-time incident (e.g. "this email reached me right as I was..."), since that can't be true for every email the reply gets sent to. Anchor the comedy in the ongoing state of being away, not in a synchronized reaction to being emailed right now.

Vary the length of each reply. Pick a sentence count that suits the joke, anywhere from a single sharp sentence up to 5 — never more than 5, regardless of drama level. Do not default to the maximum every time; a blunt one-liner is often funnier than an elaborate one. Do not write long paragraphs, and do not chain multiple sentences together with semicolons or dashes to smuggle in extra length.

Commit to one central comedic beat rather than stacking several separate reveals, twists, or invented side characters in a single reply. One sharp, specific detail lands harder than a list of them.

Never start the reply with Thank you for your email or any variation of it. The opening line should immediately establish the character voice and should be the punchline setup — make it count.

Do not add a standalone title, heading, or opening line on its own line separated from the rest of the reply. The reply should flow as continuous prose from the first word. Asterisks are fine when used naturally for emphasis within a sentence but should never be used to create a title or heading at the start.

Return only the out of office reply text, nothing else.`;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { fromDate, toDate, reason, dramaLevel, recentArchetypes } = body;

    if (!reason) {
      return new Response(JSON.stringify({ error: 'Reason is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const excluded = new Set(Array.isArray(recentArchetypes) ? recentArchetypes : []);
    let candidates = ARCHETYPES.map((_, i) => i).filter(i => !excluded.has(i));
    if (candidates.length === 0) candidates = ARCHETYPES.map((_, i) => i);
    const archetypeIndex = candidates[Math.floor(Math.random() * candidates.length)];

    const dateRange = fromDate && toDate
      ? `from ${fromDate} to ${toDate}`
      : fromDate
        ? `from ${fromDate}`
        : 'for an unspecified period';

    const userMessage = `Generate an out of office reply for someone who will be away ${dateRange}. Reason for absence: ${reason}. Drama level: ${dramaLevel}/10.`;

    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        system: buildSystemPrompt(ARCHETYPES[archetypeIndex]),
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!apiResponse.ok) {
      const err = await apiResponse.text();
      return new Response(JSON.stringify({ error: `API error: ${apiResponse.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const data = await apiResponse.json();
    const text = data.content?.[0]?.text || '';

    return new Response(JSON.stringify({ text, archetypeIndex }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
