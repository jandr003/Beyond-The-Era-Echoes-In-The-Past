const fs = require("fs");
const http = require("http");
const path = require("path");

const root = process.cwd();
const port = Number(process.env.PORT || 5173);

const contentTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const watchedFiles = [
  "index.html",
  "src/styles/main.css",
  "src/beyondTheEra.js",
];

function getReloadVersion() {
  return watchedFiles.reduce((latest, relativePath) => {
    const filePath = path.join(root, relativePath);

    try {
      return Math.max(latest, fs.statSync(filePath).mtimeMs);
    } catch {
      return latest;
    }
  }, 0);
}

function withLiveReload(data, extension) {
  if (extension !== ".html") return data;

  const script = `
    <script>
      (() => {
        let currentVersion = "";
        async function checkReload() {
          try {
            const response = await fetch("/__reload-version", { cache: "no-store" });
            const nextVersion = await response.text();
            if (currentVersion && nextVersion !== currentVersion) location.reload();
            currentVersion = nextVersion;
          } catch {}
        }
        setInterval(checkReload, 500);
        checkReload();
      })();
    </script>`;

  return Buffer.from(data.toString().replace("</body>", `${script}\n  </body>`));
}

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(request.url.split("?")[0]);

  if (requestPath === "/__reload-version") {
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain",
    });
    response.end(String(getReloadVersion()));
    return;
  }

  const normalizedPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(root, normalizedPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const body = withLiveReload(data, extension);

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[extension] || "application/octet-stream",
    });
    response.end(body);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Beyond The Era dev server running at http://127.0.0.1:${port}/`);
});
