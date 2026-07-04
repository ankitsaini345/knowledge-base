const { parentPort } = require("worker_threads");

// The blocking calculation now runs on its own isolated thread
function computeFibonacci(n) {
  if (n <= 1) return 1;
  return computeFibonacci(n - 1) + computeFibonacci(n - 2);
}

// Listen for messages from the main thread
parentPort.on("message", (n) => {
  const result = computeFibonacci(n);
  parentPort.postMessage(result); // Send result back
});
