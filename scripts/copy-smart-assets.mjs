import { cp, copyFile, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
const model = "assets/models/xtremedistil-c07f66d";
const weights = await readFile(`${model}/onnx/model_quantized.onnx`);
if (createHash("sha256").update(weights).digest("hex") !==
    "534df3a88f340b6d5f3ebf31d522b2aa03520b70bd9291ab0724cf15d7b28001") throw new Error("model checksum failed");
await mkdir("public/models", { recursive: true });
await cp(model, "public/models/xtremedistil-c07f66d", { recursive: true });
await mkdir("public/vendor/ort", { recursive: true });
const runtime = ["ort-wasm-simd-threaded.asyncify.mjs", "ort-wasm-simd-threaded.asyncify.wasm"];
for (const name of runtime) await copyFile(`node_modules/onnxruntime-web/dist/${name}`, `public/vendor/ort/${name}`);
for (const [name, source] of [["onnxruntime-LICENSE.txt", "assets/licenses/onnxruntime-LICENSE.txt"],
  ["transformers-LICENSE.txt", "node_modules/@huggingface/transformers/LICENSE"]])
  await copyFile(source, `public/vendor/${name}`);
const files = ["onnx/model_quantized.onnx", "config.json", "tokenizer.json", "tokenizer_config.json"];
let downloadBytes = (await stat("public/smart-worker.js")).size;
for (const name of files) downloadBytes += (await stat(`${model}/${name}`)).size;
for (const name of runtime) downloadBytes += (await stat(`public/vendor/ort/${name}`)).size;
await writeFile("public/smart-model.json", JSON.stringify({ downloadBytes }));
