// @ts-check

/**
 * Return the package version that npm must write to make the package and
 * lockfile describe the vendored archive, or null when they already agree.
 *
 * @param {string} packageVersion
 * @param {{ version?: unknown, packages?: Record<string, { version?: unknown }> }} lock
 * @param {string} archiveVersion
 */
function requiredPackageVersionRepair(packageVersion, lock, archiveVersion) {
  const match = /^(\d+)\.(\d+)\.\d+(?:-pre)?$/.exec(packageVersion);
  if (match == null || `${match[1]}.${match[2]}` !== archiveVersion) {
    return `${archiveVersion}.0-pre`;
  }
  return lock.version === packageVersion &&
    lock.packages?.[""].version === packageVersion
    ? null
    : packageVersion;
}

module.exports = { requiredPackageVersionRepair };
