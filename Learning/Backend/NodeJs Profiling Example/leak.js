const http = require("http");

// Global array that never gets cleaned up (Classic Memory Leak)
const requestHistoryLog = [];

const server = http.createServer((req, res) => {
  if (req.url === "/leak") {
    // Every single request appends large chunk data to a global variable
    requestHistoryLog.push({
      timestamp: Date.now(),
      metadata: new Array(10000).fill("leak_payload_data"),
    });

    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("Data logged!\n");
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OK\n");
});

server.listen(3000, () => {
  console.log("Server running on port 3000. Inspect enabled.");
});
