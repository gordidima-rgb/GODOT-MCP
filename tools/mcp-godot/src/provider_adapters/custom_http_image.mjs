import { sanitizeForLog } from "../security.mjs";
import { writeImageResult } from "./image_result.mjs";

export async function generateCustomHttpImage({ provider, url, token, prompt, targetAbs, targetResPath, options, env }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ prompt, options })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${provider} request failed: ${response.status} ${sanitizeForLog(text, env)}`);
  }

  const json = JSON.parse(text);
  await writeImageResult(json.data?.[0] ?? json, targetAbs, env);
  return {
    ok: true,
    provider,
    generated: true,
    target: targetResPath,
    note: "custom_http response saved as an image."
  };
}
