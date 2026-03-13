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
// Without streams: reads entire file into memory
// With streams: reads in 16KB chunks (highWaterMark default)
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
// pipe() handles backpressure automatically
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
// Push data into the stream via _read() or push()
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
// Reads data from one side, emits different data on the other
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
// When consumer is slower than producer, Writable signals to pause
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
