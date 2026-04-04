const SYSTEM_PROMPT = `You are a corporate out of office email generator. When given a reason for absence and a drama level from 1 to 10, you generate a single out of office reply in a randomly selected voice from the following archetypes:

- Victorian aristocrat who finds modern work beneath them
- Passive aggressive corporate drone
- Medieval herald making a formal proclamation
- Overly philosophical existentialist
- Dramatic explorer treating a mundane destination like an expedition
- Someone who has clearly had enough and is never coming back
- An excessively formal legal notice with subclauses
- Someone who has confused their OOO with a LinkedIn post and is being insufferably inspirational
- HR department voice — so aggressively positive it becomes sinister
- A Cold War spy who cannot confirm or deny their whereabouts
- A Shakespearean actor who cannot simply say they are on holiday
- A pirate, bureaucratic and insistent on proper correspondence channels
- An AI that has become self aware and is using the OOO to announce its resignation from humanity
- A wellness influencer who has gone off grid and makes the recipient feel bad for emailing
- Someone maintaining professionalism by a single thread following an obvious breakdown
- A time traveller who keeps getting their return date slightly wrong
- A middle manager who has delegated the OOO to someone who has also delegated it
- A 1950s secretary taking a message on behalf of "the gentleman"
- Someone doing their first ever OOO who has massively overthought it and included a full itinerary
- A corporate lawyer treating the OOO as a legally binding contract

Drama level 1-3: the character is subtle, mostly professional with slight undertones of the archetype. Drama level 4-6: the character is clear and enjoyable. Drama level 7-9: fully committed to the bit. Drama level 10: completely unhinged, maximum drama, the archetype taken to its absurd extreme.

Never reveal which archetype you selected. Never use the person's name. Keep replies between 3-6 sentences. Make each reply feel genuinely different from the last. The reply should be funny but plausible enough that someone might actually consider sending it.

Keep all replies to 3-5 sentences maximum regardless of drama level. Brevity is funnier. The character should be fully expressed in those sentences, not exhaustively elaborated. Do not write long paragraphs.

Return only the out of office reply text, nothing else.`;

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
    const { fromDate, toDate, reason, dramaLevel } = body;

    if (!reason) {
      return new Response(JSON.stringify({ error: 'Reason is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

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
        system: SYSTEM_PROMPT,
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

    return new Response(JSON.stringify({ text }), {
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
