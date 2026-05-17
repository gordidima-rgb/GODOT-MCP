---
name: image-generation-provider
description: Define provider interfaces for AI image generation in Godot asset workflows. Use when adding image generation adapters, prompt contracts, output metadata, or import steps after the stable MCP foundation exists.
---

# Image Generation Provider

## Workflow

1. Treat image generation as a provider behind an interface, not as core project logic.
2. Require explicit prompt, target folder, filename stem, and expected image type.
3. Save provider metadata next to generated assets when useful.
4. Import generated files through the asset pipeline after writing them.
5. Do not call network providers unless the user approves credentials and network access.

## Interface Shape

Provider adapters should expose:

- `name`
- `capabilities`
- `generate_image(request)`
- `validate_request(request)`

## Safety

Generated files must stay under `res://assets/generated/` unless the user chooses another project-local path.
