import path from "node:path";

const ALLOWED_GODOT_COMMANDS = new Set(["godot", "godot4"]);
const SECRET_NAME_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD|COOKIE|CREDENTIAL)/i;

export function isAllowedGodotCli(command, args) {
  const commandName = path.basename(command).toLowerCase();
  if (!ALLOWED_GODOT_COMMANDS.has(commandName)) {
    return false;
  }

  if (!Array.isArray(args)) {
    return false;
  }

  // Fixed project check:
  // godot --headless --path <projectRoot> --quit
  if (
    args.length === 4 &&
    args[0] === "--headless" &&
    args[1] === "--path" &&
    isNonEmptyString(args[2]) &&
    args[3] === "--quit"
  ) {
    return true;
  }

  // Fixed import pass:
  // godot --headless --path <projectRoot> --import
  if (
    args.length === 4 &&
    args[0] === "--headless" &&
    args[1] === "--path" &&
    isNonEmptyString(args[2]) &&
    args[3] === "--import"
  ) {
    return true;
  }

  // Run current project or one explicit scene. No arbitrary engine args.
  if (args.length === 2 && args[0] === "--path" && isNonEmptyString(args[1])) {
    return true;
  }
  if (
    args.length === 4 &&
    args[0] === "--path" &&
    isNonEmptyString(args[1]) &&
    args[2] === "--scene" &&
    isNonEmptyString(args[3])
  ) {
    return true;
  }

  return false;
}

export function sanitizeForLog(value, env = process.env) {
  let text = String(value ?? "");
  for (const [name, secret] of Object.entries(env)) {
    if (!SECRET_NAME_PATTERN.test(name) || typeof secret !== "string" || secret.length < 4) {
      continue;
    }
    text = text.replaceAll(secret, "[redacted]");
  }

  text = text.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [redacted]");
  text = text.replace(/(api[_-]?key=)[^&\s]+/gi, "$1[redacted]");
  text = text.replace(/(token=)[^&\s]+/gi, "$1[redacted]");
  return text;
}

export function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function safeFilenamePart(value) {
  return String(value ?? "job")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "job";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}
