import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import { buildSkillZip, checkSkillMd, crc32 } from "../scripts/build-skill-zip.mjs";

/** Minimal ZIP reader (central directory), independent from the writer. */
function read(zip) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, "end of central directory");
  const n = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < n; i++) {
    assert.equal(zip.readUInt32LE(p), 0x02014b50);
    const method = zip.readUInt16LE(p + 10), crc = zip.readUInt32LE(p + 16), csize = zip.readUInt32LE(p + 20), size = zip.readUInt32LE(p + 24);
    const nl = zip.readUInt16LE(p + 28), el = zip.readUInt16LE(p + 30), cl = zip.readUInt16LE(p + 32), off = zip.readUInt32LE(p + 42);
    const name = zip.subarray(p + 46, p + 46 + nl).toString("utf8");
    assert.equal(zip.readUInt32LE(off), 0x04034b50);
    const start = off + 30 + zip.readUInt16LE(off + 26) + zip.readUInt16LE(off + 28);
    const data = method === 8 ? inflateRawSync(zip.subarray(start, start + csize)) : zip.subarray(start, start + csize);
    assert.equal(data.length, size, name);
    assert.equal(crc32(data), crc, name + " crc");
    files[name] = data;
    p += 46 + nl + el + cl;
  }
  return files;
}

test("skill ZIP has the skill folder as its root and every file intact", () => {
  const files = read(buildSkillZip());
  const names = Object.keys(files);
  assert.ok(names.every((n) => n.startsWith("hypercodemotion/")), names.join());
  assert.ok(names.includes("hypercodemotion/SKILL.md"));
  const onDisk = (dir) => readdirSync("skills/hypercodemotion/" + dir).map((f) => `hypercodemotion/${dir}/${f}`);
  for (const n of [...onDisk("references"), ...onDisk("examples")]) assert.ok(names.includes(n), n);
  assert.deepEqual(files["hypercodemotion/SKILL.md"], readFileSync("skills/hypercodemotion/SKILL.md"));
});
test("the ZIP build is reproducible", () => assert.deepEqual(buildSkillZip(), buildSkillZip()));
test("checkSkillMd rejects what claude.ai rejects", () => {
  const md = (d, n = "hypercodemotion") => `---\nname: ${n}\ndescription: ${d}\n---\nbody`;
  assert.doesNotThrow(() => checkSkillMd(md("ok")));
  assert.throws(() => checkSkillMd(md("x".repeat(201))), /200/);
  assert.throws(() => checkSkillMd(md("ok", "other")), /folder/);
  assert.throws(() => checkSkillMd("no frontmatter"), /frontmatter/);
  assert.throws(() => checkSkillMd(md("promos: asks size")), /YAML/);
});
