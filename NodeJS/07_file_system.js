/**
 * QUESTION SET: Node.js File System (fs)
 *
 * 1. fs.promises (async/await API)
 * 2. Streaming large files
 * 3. path module
 * 4. Directory traversal / recursive walk
 * 5. Watching files (fs.watch)
 * 6. CSV processing pipeline
 */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { pipeline, Transform } = require("stream");
const { promisify } = require("util");
const pipelineAsync = promisify(pipeline);

// ─────────────────────────────────────────────
// Q1. fs.promises — async file operations
// ─────────────────────────────────────────────

async function readJsonFile(filePath) {
  const content = await fsp.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function writeJsonFile(filePath, data) {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true }); // create parent dirs if needed
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

// Atomic write: write to temp file then rename to prevent partial writes
async function atomicWrite(filePath, data) {
  const tmpPath = `${filePath}.tmp.${Date.now()}`;
  try {
    await fsp.writeFile(tmpPath, data, "utf8");
    await fsp.rename(tmpPath, filePath); // atomic on same filesystem
  } catch (err) {
    await fsp.unlink(tmpPath).catch(() => {}); // cleanup temp
    throw err;
  }
}

// File existence check (stat throws ENOENT if missing)
async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Copy file with metadata preservation
async function copyFile(src, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  await fsp.copyFile(src, dest, fs.constants.COPYFILE_EXCL); // fail if dest exists
}

// ─────────────────────────────────────────────
// Q2. Streaming large files (avoid loading entire file into memory)
// ─────────────────────────────────────────────

// Count lines without loading entire file into memory
async function countLines(filePath) {
  let count = 0;
  let remainder = "";

  const readable = fs.createReadStream(filePath, { encoding: "utf8", highWaterMark: 64 * 1024 });

  for await (const chunk of readable) {
    const lines = (remainder + chunk).split("\n");
    remainder = lines.pop(); // last incomplete line
    count += lines.length;
  }

  if (remainder.length > 0) count++; // final line without trailing newline
  return count;
}

// Stream-based file copy (efficient for large files)
async function streamCopy(src, dest) {
  const reader = fs.createReadStream(src);
  const writer = fs.createWriteStream(dest);
  await pipelineAsync(reader, writer);
}

// Stream → gzip compress
const zlib = require("zlib");

async function gzipFile(src, dest) {
  await pipelineAsync(
    fs.createReadStream(src),
    zlib.createGzip({ level: zlib.constants.Z_BEST_COMPRESSION }),
    fs.createWriteStream(dest)
  );
}

// ─────────────────────────────────────────────
// Q3. path module — cross-platform
// ─────────────────────────────────────────────

function pathExamples() {
  const full = "/home/user/docs/report.pdf";

  path.dirname(full);           // /home/user/docs
  path.basename(full);          // report.pdf
  path.basename(full, ".pdf");  // report
  path.extname(full);           // .pdf

  path.join("/home", "user", "docs");          // /home/user/docs (normalised)
  path.resolve("./config", "../.env");         // absolute resolved path

  // Cross-platform
  path.sep;   // '/' on POSIX, '\' on Windows
  path.delimiter; // ':' on POSIX, ';' on Windows (PATH env separator)

  // Safe against path traversal attacks
  const root = "/var/uploads";
  const userInput = "../../etc/passwd";
  const resolved = path.resolve(root, userInput);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error("Path traversal detected");
  }
}

// ─────────────────────────────────────────────
// Q4. Recursive directory walk
// ─────────────────────────────────────────────

// Using fs.promises.readdir with { withFileTypes: true }
async function* walkDir(dir) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath); // recurse with async generator
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

// Collect all files with a specific extension
async function findFiles(rootDir, ext) {
  const results = [];
  for await (const file of walkDir(rootDir)) {
    if (path.extname(file) === ext) results.push(file);
  }
  return results;
}

// Parallel directory walk with concurrency limit
async function walkParallel(dir, concurrency = 10) {
  const results = [];
  const sem = new Semaphore(concurrency);

  async function visit(d) {
    await sem.acquire();
    try {
      const entries = await fsp.readdir(d, { withFileTypes: true });
      const subdirs = [];
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) subdirs.push(p);
        else results.push(p);
      }
      await Promise.all(subdirs.map(visit));
    } finally {
      sem.release();
    }
  }

  await visit(dir);
  return results;
}

class Semaphore {
  #permits;
  #queue = [];
  constructor(n) { this.#permits = n; }
  acquire() {
    if (this.#permits > 0) { this.#permits--; return Promise.resolve(); }
    return new Promise((res) => this.#queue.push(res));
  }
  release() {
    if (this.#queue.length > 0) { this.#queue.shift()(); }
    else { this.#permits++; }
  }
}

// ─────────────────────────────────────────────
// Q5. File watching
// ─────────────────────────────────────────────

function watchConfig(configPath, onChange) {
  // fs.watch uses inotify/FSEvents — efficient but event may fire multiple times
  let debounceTimer;
  const watcher = fs.watch(configPath, { persistent: false }, (eventType) => {
    if (eventType === "change") {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          const config = await readJsonFile(configPath);
          onChange(config);
        } catch (err) {
          console.error("Config reload failed:", err);
        }
      }, 100);
    }
  });

  watcher.on("error", (err) => console.error("Watcher error:", err));
  return () => watcher.close(); // return cleanup function
}

// ─────────────────────────────────────────────
// Q6. CSV processing Transform stream pipeline
// ─────────────────────────────────────────────

const { createReadStream, createWriteStream } = fs;

function createCsvParserStream() {
  let tail = "";
  let headers = null;

  return new Transform({
    readableObjectMode: true, // outputs plain objects
    writableObjectMode: false, // receives buffer/string chunks

    transform(chunk, _encoding, callback) {
      const text = tail + chunk.toString("utf8");
      const lines = text.split("\n");
      tail = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const values = trimmed.split(",").map((v) => v.trim());
        if (!headers) {
          headers = values;
        } else {
          const obj = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
          this.push(obj);
        }
      }
      callback();
    },

    flush(callback) {
      if (tail.trim() && headers) {
        const values = tail.trim().split(",").map((v) => v.trim());
        const obj = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
        this.push(obj);
      }
      callback();
    },
  });
}

async function processCsv(inputPath, outputPath, transformFn) {
  await pipelineAsync(
    createReadStream(inputPath),
    createCsvParserStream(),
    new Transform({
      objectMode: true,
      transform(row, _enc, cb) {
        cb(null, JSON.stringify(transformFn(row)) + "\n");
      },
    }),
    createWriteStream(outputPath)
  );
}

/*
  INTERVIEW QUESTIONS — THEORY

  Q: What is the difference between readFile and createReadStream?
  A: readFile loads the entire file into memory as a Buffer/string.
     createReadStream reads in chunks (highWaterMark, default 64KB),
     keeping memory usage constant regardless of file size.
     For files > a few MB, always prefer streams.

  Q: Why might fs.watch fire events multiple times?
  A: Editors and OS file systems often write files in stages (rename trick) —
     write to temp, then rename to original — triggering multiple events.
     Debounce the handler to coalesce rapid events.

  Q: What does recursive: true do in fs.mkdir?
  A: Creates all intermediate directories that don't yet exist (like mkdir -p).
     Does NOT throw if the directory already exists.

  Q: What is the difference between __dirname and path.resolve('.')?
  A: __dirname: the directory of the current module file — consistent.
     path.resolve('.'): current working directory (process.cwd()) — changes if
     the process was started from a different location.

  Q: How do you safely read user-supplied file paths?
  A: Resolve to an absolute path with path.resolve, then check it starts
     with the permitted root directory.
     const resolved = path.resolve(ROOT, userInput);
     if (!resolved.startsWith(ROOT + path.sep)) throw new Error('Path traversal');

  Q: What is ENOENT vs ENOTDIR?
  A: ENOENT — no such file or directory (path does not exist).
     ENOTDIR — a component of the path exists but is not a directory.
     EACCES / EPERM — permission denied.
     Check err.code to handle specific error conditions.
*/

module.exports = {
  readJsonFile,
  writeJsonFile,
  atomicWrite,
  fileExists,
  countLines,
  gzipFile,
  walkDir,
  findFiles,
  watchConfig,
  processCsv,
};
