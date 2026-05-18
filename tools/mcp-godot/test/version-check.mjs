import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const toolRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(toolRoot, "..", "..");

const checks = [
  {
    name: "tools/mcp-godot/src/version.mjs",
    version: match(await read("tools/mcp-godot/src/version.mjs"), /SERVER_VERSION\s*=\s*"([^"]+)"/)
  },
  {
    name: "tools/mcp-godot/package.json",
    version: JSON.parse(await read("tools/mcp-godot/package.json")).version
  },
  {
    name: "addons/ai_mcp_bridge/plugin.cfg",
    version: match(await read("addons/ai_mcp_bridge/plugin.cfg"), /^version="([^"]+)"/m)
  },
  {
    name: "README.md",
    version: match(await read("README.md"), /Current version:\s*`([^`]+)`/)
  }
];

const expected = checks[0].version;
for (const check of checks) {
  assert(check.version === expected, `${check.name} has ${check.version}, expected ${expected}`);
}

console.log(`version check passed: ${expected}`);

function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

function match(text, regex) {
  const found = text.match(regex);
  assert(found, `missing version pattern: ${regex}`);
  return found[1];
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
