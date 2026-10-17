import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {validateJson} from "../src/contract.js";
const root="skills/hypercodemotion/";
test("Skill manifest has valid name and description",()=>{
 const s=readFileSync(root+"SKILL.md","utf8");
 assert.match(s,/^---\nname: hypercodemotion\ndescription: .+\n---/);
 assert.ok(s.includes("MCP validation"));
});
test("Skill references exist",()=>{
 for(const name of ["composition","visual-design","motion-design","html-scenes","validation"])
  assert.ok(existsSync(root+"references/"+name+".md"),name);
});
for(const ex of ["editorial-launch","html-scene-launch"])test(`Skill example ${ex} passes MCP structural preflight`,()=>{
 const c=JSON.parse(readFileSync(root+"examples/"+ex+".json","utf8"));
 const out=validateJson(c);
 assert.equal(out.valid,true,JSON.stringify(out.errors));
 assert.equal(out.format,"composition");
 assert.equal(out.fullyValidated,false);
});
