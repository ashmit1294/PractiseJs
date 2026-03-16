/**
 * QUESTION SET: Node.js Streams & Buffers
 *
 * Streams: process data piece by piece, not all at once
 * Types: Readable, Writable, Duplex (both), Transform (duplex + modify)
 *
 * Buffer: raw binary data in a fixed-size chunk outside V8 heap
 * Why: Node.js needs to process binary data (files, network, crypto)
 */

const fs      = require("fs");
const stream  = require("stream");
const { pipeline, Transform, Readable, Writable, PassThrough } = require("stream");
const { promisify } = require("util");

const pipelineAsync = promisify(pipeline);

// ─────────────────────────────────────────────
// Q1. Reading a large file with streams
// WHAT: How can streams read large files without loading entire file into memory?
// THEORY: Streams read in 16KB chunks (highWaterMark default), process piece-by-piece. With for-await loop, memory usage stays constant regardless of file size
// Time: O(n) file size  Space: O(c) constant chunk size
// ─────────────────────────────────────────────

// BAD for large files — reads ALL into RAM
function readFileBad(filePath) {
  const data = fs.readFileSync(filePath, "utf8");
  return data.split("\n").length;
}

// GOOD — stream line by line, constant memory
async function countLines(filePath) {
  const readable = fs.createReadStream(filePath, { encoding: "utf8" });
  let lineCount = 0;
  let partial = "";

  for await (const chunk of readable) {
    const lines = (partial + chunk).split("\n");
    partial = lines.pop(); // last partial line
    lineCount += lines.length;
  }
  if (partial) lineCount++;
  return lineCount;
}

// ─────────────────────────────────────────────
// Q2. Pipe — chain streams
// WHAT: How does pipe() connect streams and what problem does it solve?
// THEORY: pipe() chain multiple streams (source → transform → destination). Automatically handles backpressure so slow consumers pause fast producers. Prevents memory overflow
// Time: O(n) total data  Space: O(c) buffered chunks
// ─────────────────────────────────────────────
async function compressFile(inputPath, outputPath) {
  const zlib = require("zlib");

  await pipelineAsync(
    fs.createReadStream(inputPath),
    zlib.createGzip(),              // Transform: compress
    fs.createWriteStream(outputPath)
  );
  console.log("Compressed successfully");
}

// ─────────────────────────────────────────────
// Q3. Custom Readable stream
// WHAT: How do you create a custom Readable stream that generates or transforms data?
// THEORY: Extend Readable class, implement _read() method. Call this.push(data) to emit data, this.push(null) to signal EOF. objectMode for non-buffer values
// Time: O(1) per _read call  Space: O(1) per chunk
// ─────────────────────────────────────────────
class CounterStream extends Readable {
  constructor(max, options = {}) {
    super({ ...options, objectMode: true });
    this.max = max;
    this.current = 0;
  }

  _read() {
    if (this.current < this.max) {
      this.push(this.current++);
    } else {
      this.push(null); // signal end of stream
    }
  }
}

// Usage:
// const counter = new CounterStream(5);
// counter.on('data', chunk => console.log(chunk));
// counter.on('end', () => console.log('done'));
// Output: 0, 1, 2, 3, 4, done

// ─────────────────────────────────────────────
// Q4. Custom Writable stream
// WHAT: How do you create a custom Writable stream that receives and processes data?
// THEORY: Extend Writable class, implement _write(chunk, encoding, callback). MUST call callback() to signal ready for next chunk. _final() runs on stream.end()
// Time: O(1) per _write call  Space: O(m) accumulated in items array
// ─────────────────────────────────────────────
class ArrayCollector extends Writable {
  constructor(options) {
    super({ ...options, objectMode: true });
    this.items = [];
  }

  _write(chunk, encoding, callback) {
    this.items.push(chunk);
    callback(); // MUST call to signal ready for more data
  }

  _final(callback) {
    console.log("Collected:", this.items);
    callback();
  }
}

// ─────────────────────────────────────────────
// Q5. Custom Transform stream
// WHAT: How do you create a stream that reads input and emits transformed output?
// THEORY: Extend Transform class, implement _transform(chunk, encoding, callback). Call this.push(transformed) to emit result. _flush(callback) runs on end for final output
// Time: O(n) input size  Space: O(c) buffered chunks
// ─────────────────────────────────────────────

// Uppercase transformer
class UpperCaseTransform extends Transform {
  _transform(chunk, encoding, callback) {
    this.push(chunk.toString().toUpperCase());
    callback();
  }
}

// CSV to JSON transformer
class CsvToJson extends Transform {
  constructor(options) {
    super({ ...options });
    this._headers = null;
    this._buffer = "";
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split("\n");
    this._buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue;
      if (!this._headers) {
        this._headers = line.split(",").map((h) => h.trim());
      } else {
        const values = line.split(",").map((v) => v.trim());
        const obj = Object.fromEntries(this._headers.map((h, i) => [h, values[i]]));
        this.push(JSON.stringify(obj) + "\n");
      }
    }
    callback();
  }

  _flush(callback) {
    if (this._buffer.trim() && this._headers) {
      const values = this._buffer.split(",").map((v) => v.trim());
      const obj = Object.fromEntries(this._headers.map((h, i) => [h, values[i]]));
      this.push(JSON.stringify(obj) + "\n");
    }
    callback();
  }
}

// ─────────────────────────────────────────────
// Q6. Backpressure handling
// WHAT: What is backpressure and how do streams prevent memory overflow from fast producers?
// THEORY: write() returns false when buffer full (backpressure signal). Pause consumer, listen to 'drain' event to resume. pipeline() automates this. Prevents OOM errors
// Time: O(1) per write  Space: O(b) internal buffer size
// ─────────────────────────────────────────────
function writeWithBackpressure(readable, writable) {
  readable.on("data", (chunk) => {
    const canContinue = writable.write(chunk);
    if (!canContinue) {
      readable.pause();            // slow down!
      writable.once("drain", () => {
        readable.resume();         // writer ready, resume
      });
    }
  });

  readable.on("end", () => writable.end());
  readable.on("error", (err) => writable.destroy(err));
  writable.on("error", (err) => readable.destroy(err));
}
// NOTE: pipeline() handles this automatically — prefer it over manual handling

// ─────────────────────────────────────────────
// Q7. Buffer basics
// WHAT: How does Node.js Buffer work and why is it needed for binary data?
// THEORY: Buffer = fixed-size raw binary data outside V8 heap. Needed for files, crypto, network (non-text). Buffer.from/alloc/allocUnsafe for creation. toString/toJSON for conversion
// Time: O(n) for copy/concat  Space: O(n) buffer size
// ─────────────────────────────────────────────

// Create a buffer
const buf1 = Buffer.from("Hello, World!", "utf8");
const buf2 = Buffer.alloc(10);          // zero-filled, 10 bytes
const buf3 = Buffer.allocUnsafe(10);    // faster, uninitialized memory — fill before use!

console.log(buf1.toString("utf8"));     // "Hello, World!"
console.log(buf1.toString("hex"));      // hex string
console.log(buf1.toString("base64"));   // base64 string
console.log(buf1.length);               // byte count, NOT character count

// Buffer → JSON
const json = buf1.toJSON(); // { type: 'Buffer', data: [...] }

// Concatenate buffers
const combined = Buffer.concat([buf1, Buffer.from("!!!")]);

// Slice (shares memory!)
const slice = buf1.slice(0, 5); // "Hello"

// Copy (independent)
const copy = Buffer.allocUnsafe(5);
buf1.copy(copy, 0, 0, 5);

// ─────────────────────────────────────────────
// Q8. Streaming HTTP response
// WHAT: How do streams improve HTTP response handling for large data?
// THEORY: Instead of buffering entire response in memory, stream produces data as client consumes. Listen to 'close' for early disconnection. Reduces memory and latency
// Time: O(n) total data  Space: O(c) buffered chunks sent per tick
// ─────────────────────────────────────────────
const http = require("http");

const server = http.createServer((req, res) => {
  if (req.url === "/stream") {
    res.writeHead(200, { "Content-Type": "text/plain" });

    // Stream 100 lines, one per second
    let i = 0;
    const interval = setInterval(() => {
      res.write(`Line ${i++}\n`);
      if (i >= 100) {
        clearInterval(interval);
        res.end();
      }
    }, 10);

    req.on("close", () => clearInterval(interval)); // client disconnected
  } else if (req.url === "/file") {
    // Stream a file directly to response
    const fileStream = fs.createReadStream("./large-file.txt");
    fileStream.pipe(res);
    fileStream.on("error", () => { res.statusCode = 404; res.end("Not found"); });
  }
});

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is backpressure in streams?
  A: When data is produced faster than it can be consumed, the internal
     buffer fills up. The Writable signals the Readable to pause (returns
     false from write()). The Readable resumes on the 'drain' event.
     pipeline() automates this.

  Q: What is the difference between Buffer.alloc and Buffer.allocUnsafe?
  A: alloc: zero-fills the buffer (safe, slightly slower)
     allocUnsafe: leaves old memory (fast but may expose sensitive data if not filled)

  Q: When should you use streams vs loading data entirely?
  A: Streams: large files, HTTP responses, real-time data, CSV/log processing
     Buffered: small files, database rows that need full context, JSON APIs

  Q: What is objectMode in streams?
  A: By default, streams work with Buffers/strings.
     objectMode: true allows passing any JS value through the stream.
     Use for data transformation pipelines (CSV → objects → database rows).

  Q: How does pipe() differ from pipeline()?
  A: pipe() doesn't propagate errors — if source errors, destination stays open.
     pipeline() properly destroys all streams on error and returns a callback/promise.
     Always use pipeline() in production code.
*/

module.exports = { countLines, compressFile, CounterStream, ArrayCollector, CsvToJson };
