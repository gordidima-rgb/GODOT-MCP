# GODOT-MCP — Godot 4 AI Bridge for Codex, Claude, Cursor, Cline, Continue and MCP Clients

<p align="center">
  <img src="docs/assets/godot-mcp-logo.svg" alt="GODOT-MCP logo — AI bridge for Godot 4 and MCP clients" width="760">
</p>

<p align="center">
  <strong>Safe AI-assisted game development for Godot 4.x through the Model Context Protocol.</strong><br>
  Connect modern AI agents to your local Godot project for scene inspection, GDScript creation, assets, debugging, screenshots, and editor automation.
</p>

<p align="center">
  <a href="#quick-start-for-windows">Quick Start</a> ·
  <a href="#supported-ai-clients-and-models-in-2026">AI Clients</a> ·
  <a href="#universal-mcp-setup">Universal MCP Setup</a> ·
  <a href="#what-godot-mcp-does">Features</a> ·
  <a href="#multilingual-readme">10 Languages</a> ·
  <a href="docs/MCP_CAPABILITIES.md">Full Tool Map</a>
</p>

---

## What Is GODOT-MCP?

**GODOT-MCP** is a local MCP server and Godot EditorPlugin bridge for **Godot 4.x**. It gives AI coding agents a controlled, project-safe way to inspect and edit a Godot project.

Instead of asking an AI model to guess your files, scenes, and node structure, GODOT-MCP exposes a small set of safe tools for project scanning, scene creation, script generation, asset import, runtime checks, screenshot capture, and local editor context.

Current version: `0.4.1`

### Core Positioning

> **GODOT-MCP is not only for Codex.**  
> It is a model-agnostic MCP bridge for any AI client that can run a local MCP server command.

That means the project can be used with Codex, Claude, Cursor, Cline, Roo Code, Continue, VS Code-based agents, Gemini-compatible MCP clients, and local/open-source model workflows when the host application supports MCP.

## Why Use It?

Most AI assistants can write Godot code, but they usually lack reliable project context and editor feedback. GODOT-MCP adds a safer workflow:

1. **Inspect first** — scan scenes, scripts, resources, textures, materials, models, and project layout.
2. **Plan before editing** — use small MCP tools instead of unrestricted shell access.
3. **Edit inside the project only** — prevent accidental changes outside the Godot project root.
4. **Validate after changes** — run doctor checks, Godot checks, runtime status, and screenshots.
5. **Keep generation reviewable** — provider `none` writes JSON jobs by default instead of silently calling paid APIs.

## Supported AI Clients and Models in 2026

GODOT-MCP works at the **MCP client level**, not at the raw model level. A model such as GPT, Claude, Gemini, Llama, DeepSeek, Qwen, Mistral, or Grok can use GODOT-MCP only when it is running inside an app/agent that supports MCP tools.

### Recommended MCP Clients

| Client / Host | Status | How to use GODOT-MCP |
| --- | --- | --- |
| **OpenAI Codex** | Recommended | Use the generated `godot-mcp.codex.toml` or the manual TOML config below. |
| **Claude Desktop / Claude Code** | Recommended | Add `godotMCP` as a local stdio MCP server in Claude config. |
| **Cursor** | Recommended | Add a custom MCP server in Cursor settings using the Node command and args below. |
| **Cline** | Recommended | Add GODOT-MCP as a local MCP server in the Cline MCP settings. |
| **Roo Code** | Recommended | Use the same local MCP server command as Cline. |
| **Continue** | Supported when MCP is enabled | Add the GODOT-MCP command to the Continue MCP configuration. |
| **VS Code MCP-capable agents** | Supported | Use the universal JSON-style config or the extension's MCP server UI. |
| **Gemini CLI / Gemini-based agents** | Supported when MCP is available | Register GODOT-MCP as a local stdio MCP server. |
| **Local models via Ollama / LM Studio / Open WebUI** | Supported through host apps | Use a host application that supports MCP; the model itself does not connect directly. |
| **Other 2026 MCP clients** | Supported by design | Any client that can run `node .../server.mjs --project-root ...` can connect. |

### Model Families That Can Be Used Through MCP-Capable Hosts

- OpenAI GPT / Codex models
- Anthropic Claude models
- Google Gemini models
- xAI Grok models
- Meta Llama models
- Mistral models
- DeepSeek models
- Qwen models
- Local models through Ollama, LM Studio, Open WebUI, or similar hosts

The important requirement is not the model name. The requirement is: **your AI app must support local MCP servers**.

## Quick Start For Windows

You need:

- **Godot 4.x**
- **Node.js 18 or newer**
- A Godot project folder that contains `project.godot`

### 1. Open PowerShell in your Godot project folder

Open the folder that contains your `project.godot` file, then run PowerShell there.

### 2. Run the installer

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=Join-Path $env:TEMP 'install-godot-mcp.ps1'; Invoke-WebRequest 'https://raw.githubusercontent.com/gordidima-rgb/GODOT-MCP/main/tools/install-godot-mcp.ps1' -OutFile $s; & $s -ProjectPath (Get-Location)"
```

The installer copies the Godot editor plugin and the local MCP server into your project. It also enables the plugin in `project.godot`, saves a backup of `project.godot`, and writes a ready Codex config file named `godot-mcp.codex.toml`.

### 3. Start the bridge in Godot

1. Open or restart Godot 4.x.
2. Find the **AI MCP Bridge** dock.
3. Press **Start**.
4. Leave the port as `8765` unless it is already busy.

### 4. Connect your AI client

For Codex, copy the generated `[mcp_servers.godotMCP]` block from `godot-mcp.codex.toml` into your Codex config.

For Claude, Cursor, Cline, Roo Code, Continue, VS Code agents, Gemini-compatible agents, or another MCP client, use the universal MCP setup below.

### 5. Verify the setup

Ask your AI client:

```text
Run godot_doctor, then godot_project_scan.
```

## Universal MCP Setup

Use this when your AI client supports MCP but is not Codex.

Replace `<PROJECT_ROOT>` with the folder that contains `project.godot`.

### Universal MCP Server Command

```text
node <PROJECT_ROOT>/tools/mcp-godot/src/server.mjs --project-root <PROJECT_ROOT>
```

### Universal JSON-Style MCP Config

Many MCP clients use a JSON shape similar to this:

```json
{
  "mcpServers": {
    "godotMCP": {
      "command": "node",
      "args": [
        "<PROJECT_ROOT>/tools/mcp-godot/src/server.mjs",
        "--project-root",
        "<PROJECT_ROOT>"
      ],
      "env": {
        "GODOT_PROJECT_ROOT": "<PROJECT_ROOT>",
        "GODOT_MCP_PORT": "8765"
      }
    }
  }
}
```

### Universal Setup Steps

1. Install GODOT-MCP into your Godot project.
2. Start Godot and press **Start** in the **AI MCP Bridge** dock.
3. Open your AI client's MCP settings.
4. Add a new local MCP server named `godotMCP`.
5. Use `node` as the command.
6. Add the server path and `--project-root` args.
7. Add `GODOT_PROJECT_ROOT` and `GODOT_MCP_PORT=8765` as environment variables if your client supports env config.
8. Restart the AI client.
9. Ask the client to run `godot_doctor`.

## Codex Setup

The installer creates `godot-mcp.codex.toml` with the correct paths for your computer. If you need to write the config by hand, use this shape:

```toml
[mcp_servers.godotMCP]
command = "node"
args = [ "<PROJECT_ROOT>/tools/mcp-godot/src/server.mjs", "--project-root", "<PROJECT_ROOT>" ]
startup_timeout_sec = 20
env = { GODOT_PROJECT_ROOT = "<PROJECT_ROOT>", GODOT_MCP_PORT = "8765" }
```

On Windows, the Codex config file is usually here:

```powershell
$env:USERPROFILE\.codex\config.toml
```

Restart Codex after changing MCP config.

You can also use the Godot dock button **Copy Codex config**, or ask the MCP server for a ready TOML block after it is connected:

```text
Call godot_codex_config.
```

## Claude Desktop / Claude Code Setup

Use the same local server command. In Claude's MCP config, add a server like this:

```json
{
  "mcpServers": {
    "godotMCP": {
      "command": "node",
      "args": [
        "<PROJECT_ROOT>/tools/mcp-godot/src/server.mjs",
        "--project-root",
        "<PROJECT_ROOT>"
      ],
      "env": {
        "GODOT_PROJECT_ROOT": "<PROJECT_ROOT>",
        "GODOT_MCP_PORT": "8765"
      }
    }
  }
}
```

Then restart Claude and ask:

```text
Run godot_doctor and summarize the result.
```

## Cursor, Cline, Roo Code, Continue and VS Code Agents

Use the client UI for adding MCP servers:

1. Open the extension or app settings.
2. Find **MCP**, **MCP Servers**, **Tools**, or **External Tools**.
3. Add a local server named `godotMCP`.
4. Command: `node`.
5. Args:

```text
<PROJECT_ROOT>/tools/mcp-godot/src/server.mjs
--project-root
<PROJECT_ROOT>
```

6. Env:

```text
GODOT_PROJECT_ROOT=<PROJECT_ROOT>
GODOT_MCP_PORT=8765
```

7. Restart the AI client.
8. Run `godot_doctor`.

## Recommended First Prompts

```text
Run godot_doctor and explain what is configured correctly and what needs fixing.
```

```text
Run godot_project_scan, summarize my scenes, scripts, assets, and suggest the safest next development steps.
```

```text
Inspect the open scene through the editor bridge, then suggest how to improve the node structure without changing files yet.
```

```text
Create a dry-run plan for adding a simple player controller, input actions, and a test scene. Do not write files until I approve the plan.
```

## What GODOT-MCP Does

<p align="center">
  <img src="docs/assets/architecture.svg" alt="GODOT-MCP architecture — AI client, MCP server and Godot EditorPlugin bridge" width="900">
</p>

| Area | Capabilities |
| --- | --- |
| Project inspection | Scan project files, list scenes/scripts, read text `.tscn` scenes, search safe text files. |
| Scene editing | Create text scenes, add/update nodes, attach scripts, dry-run scene changes before writing. |
| GDScript workflow | Create beginner-readable `.gd` scripts, attach scripts to nodes, add autoloads. |
| Godot project setup | Add input actions, create material resources, validate expected folders. |
| 2D / 3D assets | Import images and 3D models, queue sprite/texture/model generation jobs. |
| Editor bridge | Get editor status, scene snapshots, viewport screenshots, play/stop workflows. |
| Debugging | Run doctor checks, static checks, Godot CLI checks, runtime status, screenshots. |
| AI safety | Sandbox paths, avoid destructive operations, block arbitrary shell commands. |

## What AI Can Safely Do

- Scan project files and summarize scenes, scripts, resources, materials, textures, and models.
- Return instruction-first workflow guidance for Codex, Claude, Cursor, Cline, Continue, or another MCP client.
- Guide research-first implementation for complex or unfamiliar Godot mechanics.
- Search safe text files without reading dotfiles such as `.env`.
- Create beginner-readable `.gd` scripts.
- Create simple text `.tscn` scenes and add/update nodes.
- Dry-run scene/script edits and return `plannedChanges` before writing.
- Add input actions and autoloads to `project.godot`.
- Create simple text material resources.
- Copy project-local images and 3D models into asset folders.
- Queue image, texture, sprite, and 3D model generation jobs with provider `none`.
- Update generation job status after review.
- Run static checks and Godot CLI checks when Godot is available.
- Use the optional editor bridge for live editor status, scene snapshots, play/stop, and viewport screenshots.

## What AI Cannot Do By Design

- It cannot read or write outside the project root through MCP paths.
- It cannot run arbitrary shell commands.
- It cannot delete files or nodes.
- It cannot edit binary `.scn` files as text.
- It cannot call real generation providers unless you configure providers and secrets in `.env`.
- It cannot safely guess private API keys, endpoints, cookies, or tokens.
- It cannot bypass `GODOT_MCP_READ_ONLY=true`.

## MCP Tools

The canonical tool map lives in `docs/MCP_CAPABILITIES.md`. Keep this table as the quick reference and use `godot_help` for live workflow suggestions.

| Tool | Category | Mutates project | Purpose |
| --- | --- | --- | --- |
| `godot_help` | discovery | No | Show workflows, categories, safety notes, and usage templates. |
| `godot_agent_instructions` | discovery | No | Return instruction-first guidance for AI clients. |
| `godot_doctor` | discovery | No | Check project setup, bridge reachability, providers, folders, and recommendations. |
| `godot_codex_config` | discovery | No | Return ready-to-paste Codex MCP TOML. |
| `godot_bridge_status` | bridge | No | Check whether the optional Godot editor bridge is listening. |
| `godot_editor_scene_snapshot` | bridge | No | Ask the editor bridge for open scene and selected-node context. |
| `godot_project_scan` | inspect | No | Scan folders and classify scenes, scripts, resources, textures, materials, models, and assets. |
| `godot_search_project` | inspect | No | Search safe text files for a query. |
| `godot_list_scenes` | inspect | No | List `.tscn` and `.scn` scenes. |
| `godot_list_scripts` | inspect | No | List `.gd` scripts with `extends` and `class_name` summaries. |
| `godot_read_scene` | inspect | No | Parse a text `.tscn` scene and return node structure. |
| `godot_create_scene` | edit | Yes | Create a text `.tscn` scene; supports `dry_run`. |
| `godot_add_node` | edit | Yes | Add a node to a text `.tscn` scene; supports `dry_run`. |
| `godot_update_node` | edit | Yes | Update safe basic node properties; supports `dry_run`. |
| `godot_attach_script` | edit | Yes | Create or attach a GDScript to a scene node; supports `dry_run`. |
| `godot_create_script` | edit | Yes | Create a beginner-readable `.gd` script; supports `dry_run`. |
| `godot_create_input_action` | edit | Yes | Add or update an input action in `project.godot`. |
| `godot_create_autoload` | edit | Yes | Add or update a script autoload. |
| `godot_create_material` | assets | Yes | Create a simple text `.tres` or `.material` resource. |
| `godot_import_image` | assets | Yes | Copy a project-local image into an asset folder. |
| `godot_generate_sprite` | assets | Yes | Generate or queue a sprite prompt. Provider `none` writes a job file. |
| `godot_generate_texture` | assets | Yes | Generate or queue a texture prompt. Provider `none` writes a job file. |
| `godot_import_3d_model` | assets | Yes | Copy a project-local `.glb`, `.gltf`, `.fbx`, or `.obj` model. |
| `godot_generate_3d_model` | assets | Yes | Generate or queue a 3D model prompt. Provider `none` writes a job file. |
| `godot_list_generation_jobs` | assets | No | List generation job JSON files. |
| `godot_update_generation_job_status` | assets | Yes | Update generation job status and optional note. |
| `godot_run_project` | runtime | Yes | Run the project through Godot CLI or the editor bridge; defaults to dry run. |
| `godot_runtime_status` | runtime | No | Report tracked CLI runtime and optional bridge play status. |
| `godot_stop_project` | runtime | Yes | Stop a tracked CLI run or editor-bridge play session. |
| `godot_capture_screenshot` | runtime | Yes | Save a runtime PNG screenshot through Godot Movie Maker. |
| `godot_capture_editor_viewport` | runtime | Yes | Ask the editor bridge to save a 2D or 3D viewport PNG. |
| `godot_check_errors` | inspect | No | Run static checks and optional Godot headless validation. |

## Required Debug Workflow

This MCP project treats runtime validation as part of the Godot AI workflow:

- After changing gameplay scripts, run the game or target scene, inspect the Godot console output, fix project errors, and rerun until the latest console has no errors.
- If Godot cannot run locally, report that limitation clearly.
- After adding, moving, scaling, or importing visible scene objects, run the scene, capture a screenshot, inspect placement/visibility/scale/framing, fix issues, and repeat the screenshot check until the scene looks correct.

Use `godot_help` with `category: "debug"` to get the exact MCP tool chain for these checks.

## Editor Plugin Bridge

Enable **AI MCP Bridge** in Godot, then use the dock to:

- Start or stop the localhost bridge
- Choose a port from `1024` to `65535`
- Enable **Auto-start bridge**
- Copy Codex config
- Run Doctor
- Save AI client setup notes
- Save reusable AI agent instructions
- Save 3D model provider keys for Meshy, Tripo, or a custom HTTP model endpoint into `.env`
- Queue editor chat prompts when `AI_CHAT_PROVIDER=none`

The bridge listens only on `127.0.0.1`. If a port is already occupied, the dock reports that clearly and asks you to choose another port or stop the app using it.

## Providers

Supported image provider names:

- `none`
- `openai`
- `polza_ai`
- `local_comfyui`
- `custom_http`

Supported 3D provider names:

- `none`
- `tripo`
- `meshy`
- `custom_http`

Provider `none` is the default. It writes JSON jobs under `generation_jobs/` and performs no network call.

Real keys must live in `.env` or environment variables, never in source files.

The **AI MCP Bridge** dock has a `3D model providers` section for these local settings:

```text
MODEL_3D_PROVIDER=meshy
MESHY_API_KEY=...
MESHY_QUALITY=preview
```

Use `meshy` for Meshy Text to 3D, `tripo` for Tripo text-to-model, or `custom_http` for your own GLB-returning endpoint. `godot_generate_3d_model` saves generated GLB files under `assets/generated/models/` by default and writes a `.glb.meta.json` sidecar with the prompt, provider, source, and license note.

`MESHY_QUALITY=refine` asks Meshy for the textured refine stage and may use more provider credits than `preview`.

## Common Problems

| Problem | What to do |
| --- | --- |
| `godot_doctor` says Godot CLI was not found | Install Godot 4.x on `PATH`, or set `GODOT_CLI` in `.env`. |
| Bridge is not reachable | Open Godot, enable `AI MCP Bridge`, choose a port, and press **Start**. |
| Port is occupied | Pick another port in the bridge dock, then copy your MCP config again. |
| AI client does not see tools | Restart the AI client after editing MCP config. |
| A write tool refuses to overwrite | Pass `overwrite: true` only after reviewing the existing file. |
| Generation did not create an image/model | Check `generation_jobs/`; provider `none` queues jobs by design. |
| Meshy or Tripo does not start | In the Godot dock, set `MODEL_3D_PROVIDER`, fill the provider key, press **Save 3D keys**, then restart the MCP client so `.env` is reloaded. |
| A `.scn` scene cannot be edited | Use text `.tscn` scenes for file-based edits or use the editor bridge. |
| `.env` is missing | Copy `.env.example` to `.env` and fill only the settings you need. |

## Third-Person Character Prototypes

For third-person or character prototype scenes, do not create a plain capsule as the player. Use:

```text
godot_install_third_person_controller
godot_create_third_person_prototype
```

The installer downloads `addons/PlayerCharacter` from [Jeh3no/Godot-Third-Person-Controller](https://github.com/Jeh3no/Godot-Third-Person-Controller/tree/main/addons/PlayerCharacter) and, by default, also copies sibling `addons/Arts` assets so the model, animations, sounds, and particles stay together.

## First-Person Character Prototypes

For first-person or FPS prototypes, do not create a plain capsule as the player. Use:

```text
godot_install_first_person_controller
godot_create_first_person_prototype
```

These tools use controller data from [Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller](https://github.com/Jeh3no/Godot-Advanced-State-Machine-First-Person-Controller): scenes, scripts, input defaults, and assets from `addons/PlayerCharacter` and `addons/Arts`.

The installer also keeps upstream license files when they are present, and generated prototype scenes include metadata crediting Jeh3no.

## Validation

Run these from the project root:

```powershell
node --check .\tools\mcp-godot\src\server.mjs
node --check .\tools\mcp-godot\src\providers.mjs
node --check .\tools\mcp-godot\src\provider_adapters\meshy_model.mjs
node --check .\tools\mcp-godot\src\provider_adapters\tripo_model.mjs
node .\tools\mcp-godot\test\smoke.mjs
node .\tools\mcp-godot\test\model-providers.mjs
node .\tools\mcp-godot\test\version-check.mjs
```

The GitHub Actions workflow in `.github/workflows/ci.yml` runs the same checks.

## More Recipes and Documentation

Beginner workflows live in:

- `docs/RECIPES.md`
- `docs/MCP_AGENT_INSTRUCTIONS.md`
- `docs/MCP_CAPABILITIES.md`
- `docs/MCP_GODOT_SETUP.md`
- `docs/GODOT_MCP_RESEARCH.md`
- `docs/AI_AGENT_INSTRUCTIONS.md`
- `docs/AI_CLIENT_SETUP.md`

Example game screenshot captured by MCP in `0.3.1`:

<p align="center">
  <img src="docs/assets/screenshots/runtime/third-person-capsule-0.3.1.png" alt="Runtime screenshot captured through GODOT-MCP" width="720">
</p>

## Multilingual README

GODOT-MCP is described below in 10 widely used world languages, including Russian. The full technical setup above is the canonical version; these localized sections help users quickly understand the project and start installation.

<details>
<summary><strong>English</strong></summary>

GODOT-MCP is a safe MCP bridge for Godot 4.x. It lets Codex, Claude, Cursor, Cline, Roo Code, Continue, VS Code agents, Gemini-compatible clients, and other MCP-capable AI tools inspect your Godot project, create scripts, build scenes, queue assets, run checks, and capture screenshots.

Quick start: install into your Godot project, start the **AI MCP Bridge** dock, add the `godotMCP` server to your AI client, then run `godot_doctor`.

</details>

<details>
<summary><strong>Русский</strong></summary>

GODOT-MCP — безопасный MCP-мост для Godot 4.x. Он позволяет Codex, Claude, Cursor, Cline, Roo Code, Continue, VS Code-агентам, Gemini-совместимым клиентам и другим MCP-клиентам анализировать проект Godot, создавать GDScript, собирать сцены, ставить задачи на генерацию ассетов, запускать проверки и делать скриншоты.

Быстрый старт: установите GODOT-MCP в папку проекта Godot, запустите док **AI MCP Bridge**, добавьте сервер `godotMCP` в свою нейросеть/AI-клиент, затем выполните `godot_doctor`.

</details>

<details>
<summary><strong>中文</strong></summary>

GODOT-MCP 是面向 Godot 4.x 的安全 MCP 桥接工具。它可以让 Codex、Claude、Cursor、Cline、Roo Code、Continue、VS Code 代理、Gemini 兼容客户端以及其他支持 MCP 的 AI 工具检查 Godot 项目、创建脚本、构建场景、排队生成资源、运行检查并捕获截图。

快速开始：将 GODOT-MCP 安装到 Godot 项目中，启动 **AI MCP Bridge** 面板，把 `godotMCP` 服务器添加到 AI 客户端，然后运行 `godot_doctor`。

</details>

<details>
<summary><strong>हिन्दी</strong></summary>

GODOT-MCP Godot 4.x के लिए एक सुरक्षित MCP ब्रिज है। यह Codex, Claude, Cursor, Cline, Roo Code, Continue, VS Code agents, Gemini-compatible clients और अन्य MCP-capable AI tools को आपके Godot project को inspect करने, scripts बनाने, scenes तैयार करने, asset generation jobs queue करने, checks चलाने और screenshots लेने में मदद करता है।

Quick start: इसे अपने Godot project में install करें, **AI MCP Bridge** dock start करें, अपने AI client में `godotMCP` server add करें, फिर `godot_doctor` चलाएँ।

</details>

<details>
<summary><strong>Español</strong></summary>

GODOT-MCP es un puente MCP seguro para Godot 4.x. Permite que Codex, Claude, Cursor, Cline, Roo Code, Continue, agentes de VS Code, clientes compatibles con Gemini y otras herramientas AI con soporte MCP inspeccionen tu proyecto de Godot, creen scripts, construyan escenas, pongan en cola assets, ejecuten comprobaciones y capturen screenshots.

Inicio rápido: instala GODOT-MCP en tu proyecto de Godot, inicia el dock **AI MCP Bridge**, añade el servidor `godotMCP` a tu cliente AI y ejecuta `godot_doctor`.

</details>

<details>
<summary><strong>Français</strong></summary>

GODOT-MCP est un pont MCP sécurisé pour Godot 4.x. Il permet à Codex, Claude, Cursor, Cline, Roo Code, Continue, aux agents VS Code, aux clients compatibles Gemini et aux autres outils IA compatibles MCP d'inspecter votre projet Godot, de créer des scripts, de construire des scènes, de mettre des assets en file d'attente, d'exécuter des vérifications et de capturer des captures d'écran.

Démarrage rapide : installez GODOT-MCP dans votre projet Godot, lancez le dock **AI MCP Bridge**, ajoutez le serveur `godotMCP` à votre client IA, puis exécutez `godot_doctor`.

</details>

<details>
<summary><strong>العربية</strong></summary>

GODOT-MCP هو جسر MCP آمن لـ Godot 4.x. يتيح لـ Codex وClaude وCursor وCline وRoo Code وContinue ووكلاء VS Code والعملاء المتوافقين مع Gemini وأي عميل AI يدعم MCP فحص مشروع Godot، إنشاء السكربتات، بناء المشاهد، إضافة مهام توليد الأصول إلى قائمة الانتظار، تشغيل الفحوصات، والتقاط لقطات شاشة.

البدء السريع: ثبّت GODOT-MCP داخل مشروع Godot، شغّل لوحة **AI MCP Bridge**، أضف الخادم `godotMCP` إلى عميل الذكاء الاصطناعي، ثم شغّل `godot_doctor`.

</details>

<details>
<summary><strong>বাংলা</strong></summary>

GODOT-MCP হলো Godot 4.x-এর জন্য একটি নিরাপদ MCP bridge। এটি Codex, Claude, Cursor, Cline, Roo Code, Continue, VS Code agents, Gemini-compatible clients এবং অন্যান্য MCP-capable AI tools-কে আপনার Godot project inspect করতে, scripts তৈরি করতে, scenes বানাতে, asset generation jobs queue করতে, checks চালাতে এবং screenshots নিতে সাহায্য করে।

Quick start: আপনার Godot project-এ GODOT-MCP install করুন, **AI MCP Bridge** dock start করুন, AI client-এ `godotMCP` server add করুন, তারপর `godot_doctor` চালান।

</details>

<details>
<summary><strong>Português</strong></summary>

GODOT-MCP é uma ponte MCP segura para Godot 4.x. Ele permite que Codex, Claude, Cursor, Cline, Roo Code, Continue, agentes do VS Code, clientes compatíveis com Gemini e outras ferramentas de IA com suporte a MCP inspecionem seu projeto Godot, criem scripts, montem cenas, enfileirem assets, executem verificações e capturem screenshots.

Início rápido: instale o GODOT-MCP no seu projeto Godot, inicie o dock **AI MCP Bridge**, adicione o servidor `godotMCP` ao seu cliente de IA e execute `godot_doctor`.

</details>

<details>
<summary><strong>اردو</strong></summary>

GODOT-MCP Godot 4.x کے لیے ایک محفوظ MCP bridge ہے۔ یہ Codex، Claude، Cursor، Cline، Roo Code، Continue، VS Code agents، Gemini-compatible clients اور دوسرے MCP-capable AI tools کو آپ کا Godot project inspect کرنے، scripts بنانے، scenes تیار کرنے، asset generation jobs queue کرنے، checks چلانے اور screenshots لینے میں مدد دیتا ہے۔

Quick start: GODOT-MCP کو اپنے Godot project میں install کریں، **AI MCP Bridge** dock start کریں، اپنے AI client میں `godotMCP` server add کریں، پھر `godot_doctor` چلائیں۔

</details>

## SEO Keywords

Godot MCP, Godot 4 MCP, Godot AI tools, Codex Godot, Claude Godot MCP, Cursor Godot MCP, Cline Godot, Continue MCP, Model Context Protocol Godot, AI game development, GDScript automation, Godot editor automation, Godot scene generation, Godot debugging tools, AI-assisted Godot development, MCP game development, Godot AI agent.

## License

MIT License. See `LICENSE` for details.
