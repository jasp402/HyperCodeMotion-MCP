# MCP validation and Studio handoff

## Preflight loop

1. When HyperCodeMotion MCP is connected, call `get_capabilities` before designing layer properties and effects.
2. Generate the correct JSON root: complete composition with `layers`, design with `elements`, or improvement patch with `add/change/remove/sfx`.
3. Call `validate_json` with that JSON. For an improvement patch, include the existing composition as optional `composition` context whenever available.
4. Correct errors and investigate warnings. Validate again after corrections.
5. Use the intended Studio import mode and review its actual preview and import warnings.

## What validation proves

Current MCP validation is structural preflight against a source-pinned capability snapshot. It reports `fullyValidated: false`. Therefore `valid: true` does not certify visual quality, rendering, animation smoothness, exact asset resolution, or acceptance of every feature by Studio.

If the MCP is not connected, never claim it was used. If no preview has been inspected, never state that the result rendered successfully.

## Repair priorities

First fix top-level format and missing data, then timing and references, unsupported properties/effects, document/asset links, and finally visually inspect composition, continuity and typography. Preserve original project elements and audio unless changes are requested.

## Security

Do not share private prompts or user images in publicly committed examples. Do not execute embedded code or expressions as part of structural checks.
