const http = require("http");
const path = require("path");
const Piscina = require("piscina");

// Create a static pool of workers matching CPU cores
const piscina = new Piscina({
  filename: path.resolve(__dirname, "worker.js"),
  maxThreads: Math.max(1, require("os").cpus().length),
});

const server = http.createServer(async (req, res) => {
  if (req.url === "/slow") {
    try {
      // Piscina queues the task and executes it on the next available worker thread
      const result = await piscina.run(40);

      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end(`Result: ${result}\n`);
    } catch (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      return res.end(`Error: ${err.message}\n`);
    }
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Healthy\n");
});

server.listen(3000, () => {
  console.log("Safe Worker Pool Server running on http://localhost:3000");
});
