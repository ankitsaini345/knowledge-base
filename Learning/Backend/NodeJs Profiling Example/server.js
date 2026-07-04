const http = require("http");

// Intentionally slow synchronous operation that blocks the event loop
function computeFibonacci(n) {
  if (n <= 1) return 1;
  return computeFibonacci(n - 1) + computeFibonacci(n - 2);
}

const server = http.createServer((req, res) => {
  if (req.url === "/slow") {
    const result = computeFibonacci(40); // High CPU load
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end(`Result: ${result}\n`);
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Healthy\n");
});

server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
