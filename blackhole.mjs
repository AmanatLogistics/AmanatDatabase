// A TCP listener that accepts the connection and then says nothing at all —
// exactly what a paused database does to a serverless function.
import net from "node:net";
net.createServer((socket) => {
  console.log("blackhole: accepted a connection, and will now never reply");
  socket.on("error", () => {});
}).listen(5599, "127.0.0.1", () => console.log("blackhole listening on 5599"));
