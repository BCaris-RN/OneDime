import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { zipSync } from "fflate";

const git = (...args) => execFileSync("git", args, { maxBuffer: 64 * 1024 * 1024 });
const base = "4be44f57dd18e4ed7dd80eb3666e525f2f9bb955";
const head = git("rev-parse", "HEAD").toString().trim();
assert.equal(git("status", "--porcelain", "--untracked-files=no").toString(), "", "Commit the reviewed sources before packaging");
const files = git("diff", "--name-only", "-z", base, head).toString().split("\0").filter(Boolean);
const archive = {
  "full-diff.patch": git("diff", "--binary", base, head),
  "changed-files.txt": git("diff", "--name-status", base, head),
  "bot-comments.json": readFileSync("reviews/claude-pr6/bot-comments.json"),
  "ci-final.json": readFileSync("reviews/claude-pr6/ci-final.json"),
};
const manifest = [];
for (const path of files) {
  let content;
  let source = "head";
  try { content = git("show", `${head}:${path}`); }
  catch { content = git("show", `${base}:${path}`); source = "deleted-base"; }
  const entry = `${source}/${path}`;
  archive[entry] = content;
  manifest.push({ path, entry, bytes: content.length, sha256: createHash("sha256").update(content).digest("hex") });
}
archive["manifest.json"] = Buffer.from(JSON.stringify({ base, head, generatedAt: new Date().toISOString(), files: manifest }, null, 2));
const output = "reviews/claude-pr6/onedime-pr6-source-review.zip";
const bytes = zipSync(archive, { level: 6 });
writeFileSync(output, bytes);
console.log(JSON.stringify({ output, base, head, changedFiles: files.length, archiveEntries: Object.keys(archive).length, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }, null, 2));
