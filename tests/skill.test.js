import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {validateJson} from "../src/contract.js";
import {TRANSITION_TYPES} from "../src/transitions.js";
const root="skills/hypercodemotion/";
test("Skill manifest has valid name and description",()=>{
 const s=readFileSync(root+"SKILL.md","utf8");
 assert.match(s,/^---\nname: hypercodemotion\ndescription: .+\n---/);
 assert.ok(s.includes("MCP validation"));
 assert.match(s,/\.hcmotion/);
});
test("Skill description fits claude.ai's 200 character limit",()=>{
 const m=/^---\nname: (.+)\ndescription: (.+)\n---/.exec(readFileSync(root+"SKILL.md","utf8"));
 assert.ok(m[2].length<=200,m[2].length+" chars");
 assert.ok(m[1].length<=64&&/^[a-z0-9-]+$/.test(m[1]));
});
test("Skill documents scene transitions with the Studio's exact types",()=>{
 const doc=readFileSync(root+"references/motion-design.md","utf8");
 assert.ok(doc.includes("## Scene transitions"));
 for(const t of TRANSITION_TYPES)assert.ok(doc.includes("`"+t+"`"),t);
 assert.match(readFileSync(root+"SKILL.md","utf8"),/motion-design\.md#scene-transitions/);
});
test("Skill asks for the canvas size before designing",()=>{
 const s=readFileSync(root+"SKILL.md","utf8");
 const first=s.indexOf("1. **Canvas size first**");
 assert.ok(first>0&&first<s.indexOf("2. **Brief"));
 for(const size of ["1080×1920","1080×1080","1080×1350","1080×1440","1920×1080"])assert.ok(s.includes(size),size);
});
test("Skill references exist",()=>{
 for(const name of ["composition","visual-design","motion-design","html-scenes","validation"])
  assert.ok(existsSync(root+"references/"+name+".md"),name);
});
for(const ex of ["editorial-launch","html-scene-launch","scene-transitions"])test(`Skill example ${ex} passes MCP structural preflight`,()=>{
 const c=JSON.parse(readFileSync(root+"examples/"+ex+".json","utf8"));
 const out=validateJson(c);
 assert.equal(out.valid,true,JSON.stringify(out.errors));
 assert.equal(out.format,"composition");
 assert.equal(out.fullyValidated,false);
});
