// @ts-check
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  const {
    fetchImpl = globalThis.fetch,
    maxRetries = 3,
    retryDelayMs = 2000,
    timeoutMs = 30000,
  } = retryOptions;

  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      console.error(`Fetch attempt ${i + 1} failed:`, error.message);
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs * (i + 1)),
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("Failed to fetch after " + maxRetries + " retries");
}

async function getLatestExifToolVersion(retryOptions) {
  try {
    // Try GitHub tags API first (cleaner than RSS)
    const response = await fetchWithRetry(
      "https://api.github.com/repos/exiftool/exiftool/tags",
      {},
      retryOptions,
    );
    const tags = await response.json();

    if (tags && tags.length > 0) {
      // Get the first (latest) tag
      const latestTag = tags[0].name;
      // Add .0 patch version if it's just major.minor
      return latestTag.includes(".") && latestTag.split(".").length === 2
        ? latestTag + ".0"
        : latestTag;
    }
  } catch (error) {
    console.error(
      "GitHub API failed, falling back to RSS feed:",
      error.message,
    );
  }

  // Fallback to RSS feed
  const xml2js = require("xml2js");
  const response = await fetchWithRetry(
    "https://exiftool.org/rss.xml",
    {},
    retryOptions,
  );
  const xmlData = await response?.text();
  const parser = new xml2js.Parser();
  const xmlDoc = await parser.parseStringPromise(xmlData);
  const items = xmlDoc.rss.channel[0].item;

  for (const item of items) {
    const title = item.title[0];
    const version = /\b(\d{2}\.\d+)\b/.exec(title);
    if (version && version[1]) {
      return version[1] + ".0";
    }
  }

  throw new Error("No version found in RSS feed");
}

function normalizeExifToolVersion(version) {
  const match = /^(\d+\.\d+)(?:\.\d+)?(?:-pre)?$/.exec(version);
  if (match == null) throw new Error(`Invalid ExifTool version: ${version}`);
  return `${match[1]}.0`;
}

function getCurrentVersion() {
  const manifestPath = join(__dirname, "..", "vendor-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  return normalizeExifToolVersion(manifest.version);
}

async function checkForUpdate() {
  const currentVersion = getCurrentVersion();
  const latestVersion = await getLatestExifToolVersion();

  return {
    currentVersion,
    latestVersion,
    updateAvailable: currentVersion !== latestVersion,
  };
}

module.exports = {
  fetchWithRetry,
  getLatestExifToolVersion,
  normalizeExifToolVersion,
  getCurrentVersion,
  checkForUpdate,
};
