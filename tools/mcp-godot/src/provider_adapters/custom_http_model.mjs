import { sanitizeForLog } from "../security.mjs";
import { writeModelResult, writeModelMetadata } from "./model_result.mjs";

export async function generateCustomHttpModel({ provider, url, token, prompt, targetAbs, targetResPath, options, env }) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({
      prompt,
      output_format: "glb",
      options
    })
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${provider} model request failed: ${response.status} ${sanitizeForLog(text, env)}`);
  }

  if (!contentType.includes("application/json")) {
    await writeModelResult(await response.arrayBuffer(), targetAbs, env);
  } else {
    const json = await response.json();
    const result = Array.isArray(json.data) ? json.data[0] : json.data ?? json;
    await writeModelResult(result, targetAbs, env);
  }

  await writeModelMetadata(targetAbs, {
    provider,
    source: "custom_http",
    prompt,
    targetPath: targetResPath,
    createdAt: new Date().toISOString(),
    licenseNote: "Custom provider output rights depend on the configured upstream service."
  });

  return {
    ok: true,
    provider,
    generated: true,
    target: targetResPath,
    metadataPath: `${targetResPath}.meta.json`,
    source: "custom_http",
    licenseNote: "Custom provider output rights depend on the configured upstream service.",
    note: "custom_http response saved as a Godot 3D model."
  };
}
