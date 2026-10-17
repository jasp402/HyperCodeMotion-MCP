# HTML scenes, images, and external assets

Studio `Composition.docs` can hold HTML/CSS per document ID. An HTML layer can point at that document using `props.doc` and `props.part`. `data-hcm="name"` identifies an individually addressable piece. A layer with `part: ""` represents the base document background.

Example shape:
```json
{
  "docs": {
    "scene1": "<!doctype html><html><body><h1 data-hcm=\"headline\">Hello</h1></body></html>"
  },
  "layers": [
    {"id":"base","name":"Base","type":"html","start":0,"end":3,"props":{"doc":"scene1","part":""}},
    {"id":"headline","name":"Headline","type":"html","start":0.2,"end":3,"props":{"doc":"scene1","part":"headline"}}
  ]
}
```
This fragment is **not** a complete standalone composition by itself. Wrap in the full root format when importing.

A complete, working example lives in [examples/html-scene-launch.json](../examples/html-scene-launch.json).

## Recipe that works in Studio

- One document per scene (`s1`, `s2`…), sized exactly to the canvas: `html,body{width:<W>px;height:<H>px;margin:0;background:transparent}`.
- Position each piece absolutely and give it `data-hcm`. Add `width:max-content` to text pieces so Studio measures the text, not the full row.
- One `html` layer for the base (`part: ""`) plus one per part, with staggered `start` times and an `fx.in` entrance (`rise`, `pop`, `fade`…; read the list from `get_capabilities`).
- Name layers for humans (`s1 · titular`) so they are easy to find in the editor.
- Load fonts with a Google Fonts `<link>` in the document head.
- Big headlines: letter-spacing no tighter than `-0.03em`.

## Choosing layers

Use HTML scenes for precise editorial layouts, dashboards and typographic composition. Use native layers when individual transformations, geometry or effects must stay directly editable. Combine both only with intentional alignment and correct layer order.

## Image assets

A photo in a user prompt is a **reference**, not automatically an embedded asset. Composition `assets` maps asset IDs to actual data URLs; image layers must use an asset/source format Studio supports. Verify IDs and actual media availability instead of inventing a Pexels image URL, claiming a fetch succeeded, or fabricating a brand logo.

An external asset may require Studio to fetch and embed it. If not available, supply an explicitly labelled placeholder and state what is required to complete import. Avoid remote dependencies for reproducible compositions when assets can be bundled.

## Merging document-driven scenes

Namespace document IDs (`s1`, `s2`) and `data-hcm` parts; create corresponding HTML layers with the correct scene times; preserve shared brand elements across cuts. Avoid untrusted or unnecessary external scripts in HTML. The MCP structural validator does not execute or visually verify embedded HTML.
