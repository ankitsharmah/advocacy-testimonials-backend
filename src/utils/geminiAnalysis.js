const OpenAI = require("openai");
const { analyzeSentiment } = require("./sentiment");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const analyzeWithAI = async (text, rating) => {
  try {
    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile", // Groq free model
      messages: [
        {
          role: "user",
          content: `
Analyze this review.

Return ONLY valid JSON.

{
  "sentiment": "positive|neutral|negative",
  "sentimentScore": number between -1 and 1,
  "tags": ["tag1","tag2","tag3"],
  "summary": "max 20 words"
}

Rating: ${rating}/5
Review: ${text}
`,
        },
      ],
      temperature: 0,
    });

    const raw = response.choices[0].message.content
      .replace(/```(?:json)?\n?/gi, "")
      .trim();
    const parsed = JSON.parse(raw);
    console.log(raw);
    return parsed;
  } catch (err) {
    console.error("AI analysis failed:", err.message);
    return {
      sentiment: "neutral",
      sentimentScore: 0,
      tags: [],
      summary: "",
    };
  }
};

module.exports = { analyzeWithAI, analyzeWithGemini: analyzeWithAI };
