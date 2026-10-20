/*  (o) OneDime | public/smart-worker.ts
 *  ----------------------------------------------------------
 *  Closed-label suggestions on this device; no inference server.
 */
import { env, pipeline } from "@huggingface/transformers";
import { intentLabels, smartRoute } from "./smart-routes.js";
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";
env.useBrowserCache = true;
env.useWasmCache = true;
const wasm = env.backends.onnx.wasm!;
wasm.numThreads = 1;
wasm.proxy = false;
wasm.wasmPaths = {
  mjs: `${location.origin}/vendor/ort/ort-wasm-simd-threaded.asyncify.mjs`,
  wasm: `${location.origin}/vendor/ort/ort-wasm-simd-threaded.asyncify.wasm`
};
const model = pipeline("zero-shot-classification", "xtremedistil-c07f66d", {
  dtype: "q8", device: "wasm", local_files_only: true,
  progress_callback: () => postMessage({ progress: true })
});
type Input = { payer: string; netCents: number; kind: string };
onmessage = async (event: MessageEvent<{ id: string; rows: Input[] }>) => {
  try {
    const classifier = await model;
    const suggestions = [];
    for (const row of event.data.rows.slice(0, 10)) {
      const result = await classifier(JSON.stringify({
        payer: row.payer.slice(0, 120), amountCents: row.netCents, kind: row.kind.slice(0, 120)
      }), [...intentLabels], { multi_label: true, hypothesis_template: "This payment is for {}." });
      suggestions.push(smartRoute(result.labels, result.scores));
    }
    postMessage({ id: event.data.id, suggestions });
  } catch { postMessage({ id: event.data.id, error: true }); }
};
