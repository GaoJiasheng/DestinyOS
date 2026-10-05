import { jsonrepair } from 'jsonrepair';
// DESIGN-GAP: Real structured responses can leave quoted chart labels unescaped; repair syntax locally, preserve raw receipts and validate schema/IDs separately, without another paid request.
/** Parse provider evaluation JSON, repairing quoting syntax without generating replacement answers or scores. */
export function parseEvalJson(text: string): unknown {
  const plain = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
  try {
    return JSON.parse(plain);
  } catch {
    return JSON.parse(jsonrepair(plain));
  }
}
