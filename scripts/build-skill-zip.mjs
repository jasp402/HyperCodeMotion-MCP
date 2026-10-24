#!/usr/bin/env node
/**
 * Builds dist/hypercodemotion-skill.zip from skills/hypercodemotion with no dependencies
 * (no `zip` binary needed: works on Windows, macOS and Linux with Node 18+).
 *
 *   npm run build:skill            -> dist/hypercodemotion-skill.zip
 *   node scripts/build-skill-zip.mjs [out.zip]
 *
 * Layout required by claude.ai: the skill folder is the ZIP root (hypercodemotion/SKILL.md, ...),
 * the folder name equals the `name` in SKILL.md. The script also checks the SKILL.md frontmatter
 * against the published limits (name <= 64 chars, description <= 200 chars) and fails if it breaks them.
 */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SKILL_NAME = "hypercodemotion";
const skillDir = join(repo, "skills", SKILL_NAME);

const table = Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
export const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** Throws if SKILL.md would be rejected by claude.ai (limits from the Claude Help Center). */
export function checkSkillMd(text, folder = SKILL_NAME) {
  const m = /^---\r?\nname: (.+)\r?\ndescription: (.+)\r?\n---/.exec(text);
  if (!m) throw new Error("SKILL.md must start with single-line `name:` and `description:` frontmatter");
  const [, name, description] = m;
  if (name !== folder) throw new Error(`skill name "${name}" must equal the folder name "${folder}"`);
  if (!/^[a-z0-9-]{1,64}$/.test(name) || /anthropic|claude/.test(name)) throw new Error("name: lowercase letters, numbers, hyphens; max 64; no 'anthropic'/'claude'");
  if (description.length > 200) throw new Error(`description is ${description.length} chars; claude.ai allows at most 200`);
  return { name, description };
}

function* walk(dir) {
  for (const entry of readdirSync(dir).sort()) {
    if (entry === ".DS_Store" || entry === "__MACOSX") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p); else yield p;
  }
}

/** Returns the ZIP bytes (deterministic: fixed timestamp, sorted entries). */
export function buildSkillZip() {
  checkSkillMd(readFileSync(join(skillDir, "SKILL.md"), "utf8"));
  const dosTime = 0, dosDate = (0 << 9) | (1 << 5) | 1; // 1980-01-01
  const parts = [], central = [];
  let offset = 0;
  for (const file of walk(skillDir)) {
    const name = Buffer.from(SKILL_NAME + "/" + relative(skillDir, file).split(sep).join("/"));
    const raw = readFileSync(file);
    const data = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE((3 << 8) | 20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8); head.writeUInt16LE(8, 10);
    head.writeUInt16LE(dosTime, 12); head.writeUInt16LE(dosDate, 14); head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(data.length, 20); head.writeUInt32LE(raw.length, 24); head.writeUInt16LE(name.length, 28);
    head.writeUInt32LE(((0o100644) << 16) >>> 0, 38); head.writeUInt32LE(offset, 42);
    parts.push(local, name, data);
    central.push(head, name);
    offset += local.length + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = resolve(process.argv[2] ?? join(repo, "dist", "hypercodemotion-skill.zip"));
  mkdirSync(dirname(out), { recursive: true });
  const zip = buildSkillZip();
  writeFileSync(out, zip);
  console.log(`${out} (${zip.length} bytes)`);
}
