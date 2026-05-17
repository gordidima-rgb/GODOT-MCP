import fs from "node:fs/promises";
import path from "node:path";
import { sanitizeForLog } from "../security.mjs";

export async function writeImageResult(result, targetAbs, env) {
  if (typeof result.b64_json === "string") {
    await fs.mkdir(path.dirname(targetAbs), { recursive: true });
    await fs.writeFile(targetAbs, Buffer.from(result.b64_json, "base64"));
    return;
  }

  if (typeof result.url === "string") {
    const imageResponse = await fetch(result.url);
    if (!imageResponse.ok) {
      throw new Error(`image URL fetch failed: ${imageResponse.status}`);
    }
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    await fs.mkdir(path.dirname(targetAbs), { recursive: true });
    await fs.writeFile(targetAbs, bytes);
    return;
  }

  throw new Error(`provider response did not include b64_json or url: ${sanitizeForLog(JSON.stringify(result), env)}`);
}
