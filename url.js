import { writeFile } from "fs/promises";
import { readFile } from "fs/promises";
import { createServer } from "http";
import crypto from "crypto";
import path from "path";
import { mkdir } from "fs/promises";

const serverFile = async (res, filePath, contentType) => {
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    return res.end(data);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("404 Page not Found");
  }
};

const DATA_DIR = path.resolve("data");
const DATAFILE = path.join(DATA_DIR, "links.js");

const ensureDataFile = async () => {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATAFILE, JSON.stringify({}), { encoding: "utf-8", flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
};

const loadLinks = async () => {
  try {
    const data = await readFile(DATAFILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      await ensureDataFile();
      return {};
    }
    throw error;
  }
};

const saveLinks = async (links) => {
  try {
    await writeFile(DATAFILE, JSON.stringify(links, null, 2), { encoding: "utf-8" });
  } catch (error) {
    console.error("Error saving links:", error);
    throw error;
  }
};

const server = createServer(async (req, res) => {
  if (req.method === "GET") {
    if (req.url === "/") {
      return serverFile(res, path.join("public", "index.html"), "text/html");
    } else if (req.url === "/style.css") {
      return serverFile(res, path.join("public", "style.css"), "text/css");
    } else if (req.url === "/links") {
      const links = await loadLinks();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(links));
    } else {
      const links = await loadLinks();
      const shortCode = req.url.slice(1);
      if (links[shortCode]) {
        res.writeHead(302, { Location: links[shortCode] });
        return res.end();
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Shortened URL not found");
    }
  }

  if (req.method === "POST" && req.url === "/shorten") {
    const links = await loadLinks();
    let body = "";

    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { url, shortCode } = JSON.parse(body);

        if (!url) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("URL is required");
        }

        const safeShortCode =
          shortCode || crypto.randomBytes(4).toString("hex").replace(/[^a-zA-Z0-9]/g, "");

        if (links[safeShortCode]) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("Short Code already exists");
        }

        links[safeShortCode] = url;
        await saveLinks(links);

        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: true, shortCode: safeShortCode }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("Internal Server Error");
      }
    });
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server Listening at ${PORT}`);
});
