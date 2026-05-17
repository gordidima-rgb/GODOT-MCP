import { sanitizeForLog } from "../security.mjs";
import { writeImageResult } from "./image_result.mjs";

export async function generateOpenAIImage({ provider, prompt, targetAbs, targetResPath, options, env }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      provider,
      generated: false,
      message: "OPENAI_API_KEY is missing. Put it in .env or environment variables, never in source files."
    };
  }

  const payload = {
    model: env.OPENAI_IMAGE_MODEL || "gpt-image-1.5",
    prompt,
    size: options.size || "1024x1024",
    n: 1
  };

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI image request failed: ${response.status} ${sanitizeForLog(text, env)}`);
  }

  const json = JSON.parse(text);
  await writeImageResult(json.data?.[0] ?? {}, targetAbs, env);
  return {
    ok: true,
    provider,
    generated: true,
    target: targetResPath,
    model: payload.model,
    note: "Image file was written. Godot will create/update the .import file when the editor imports resources."
  };
}
