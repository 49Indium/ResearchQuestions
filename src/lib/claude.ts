import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export function buildSystemPrompt(): string {
  return `You are a mathematics research assistant. The user will ask you questions about mathematical concepts, proofs, examples, and theory.

When answering:
- Use LaTeX notation with $ for inline math and $$ for display math
- Be precise and rigorous
- Provide examples when helpful
- Reference relevant theorems, definitions, or results
- If a question is unclear, ask for clarification
- Structure longer answers with clear sections`;
}
