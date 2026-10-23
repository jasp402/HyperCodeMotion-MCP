# Prompt Motion Playwright PoC

Isolated branch experiment. POST /api/get-video on the branch Preview URL.

Example: `curl -i -X POST "$PREVIEW/api/get-video" -H "Content-Type: application/json" --data '{"url":"https://prompt-motion.com/slvdev-64c45a"}'`

Add `"download":true` to attempt to return MP4 directly (20 MB limit). JSON diagnostics report HTML/Cloudflare challenges without bypassing them. This is a server-side PoC, not a validated video download. The production domain /get-video remains untouched until merge and routing setup.
