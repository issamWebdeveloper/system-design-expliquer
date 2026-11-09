// Minimal static server for the exported site in ./out (used by `npm run preview` and the e2e tests).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "out");
const port = Number(process.env.PORT ?? 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function resolveFile(urlPath) {
  const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, safe);
  const info = await stat(file).catch(() => null);
  if (info?.isDirectory()) file = join(file, "index.html");
  return (await stat(file).catch(() => null))?.isFile() ? file : null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const file = await resolveFile(pathname);
  if (!file) {
    res.writeHead(404, { "content-type": types[".html"] });
    res.end(await readFile(join(root, "404.html")).catch(() => "Not found"));
    return;
  }
  // Extensionless files in the export are the generated OG images.
  const type = types[extname(file)] ?? (pathname.endsWith("opengraph-image") ? "image/png" : "application/octet-stream");
  res.writeHead(200, { "content-type": type });
  res.end(await readFile(file));
}).listen(port, () => console.log(`Serving ./out at http://localhost:${port}`));
