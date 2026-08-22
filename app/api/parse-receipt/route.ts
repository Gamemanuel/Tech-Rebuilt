import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY; // or HACKCLUB_AI_API_KEY depending on what you named it
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 501 });
  }

  const { imageUrl } = await req.json();
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  const prompt = `You will be shown a photo of a purchase receipt. Extract:
- vendor: the store/merchant name
- date: the purchase date as YYYY-MM-DD (best guess if partially legible)
- amount: the total amount paid, as a plain number (e.g. 42.17)
- category: a short guess like "parts", "shipping", "tools", "inventory", "other"

Respond with ONLY a JSON object with keys vendor, date, amount, category. No prose, no markdown fences.`;

  try {
    const response = await fetch("https://ai.hackclub.com/proxy/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-opus-4.8",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: `Hack Club AI API error: ${detail}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json({
      vendor: parsed.vendor ?? "",
      date: parsed.date ?? "",
      amount: typeof parsed.amount === "number" ? parsed.amount : parseFloat(parsed.amount) || 0,
      category: parsed.category ?? "other",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to parse receipt" }, { status: 500 });
  }
}