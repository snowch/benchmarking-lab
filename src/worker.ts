// Copyright © 2026 Christopher Snow
import { benchmark, type Settings } from "./benchmark";
self.onmessage = async (event: MessageEvent<Settings>) => {
  try {
    const result = await benchmark(event.data, (message) =>
      self.postMessage({ type: "progress", message }),
    );
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
