'use strict';

var path = require('path');
var download$1 = require('download');
var fs = require('fs');
var crypto = require('node:crypto');

const BETA_CONFIG = {
    year: "2026",
    isAlpha: false,
    expiration: new Date(2026, 0, 10),
    surveyUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeiBaYQ0CME-Fjt2G3d4uJ1cKOQfj8NPTPh7mNvA_ZQFQwGHw/viewform?usp=header"
};

const semver = /^[v^~<>=]*?(\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+)(?:\.([x*]|\d+))?(?:-([\da-z\-]+(?:\.[\da-z\-]+)*))?(?:\+[\da-z\-]+(?:\.[\da-z\-]+)*)?)?)?$/i;
const validateAndParse = (version) => {
    if (typeof version !== 'string') {
        throw new TypeError('Invalid argument expected string');
    }
    const match = version.match(semver);
    if (!match) {
        throw new Error(`Invalid argument not valid semver ('${version}' received)`);
    }
    match.shift();
    return match;
};
const isWildcard = (s) => s === '*' || s === 'x' || s === 'X';
const tryParse = (v) => {
    const n = parseInt(v, 10);
    return isNaN(n) ? v : n;
};
const forceType = (a, b) => typeof a !== typeof b ? [String(a), String(b)] : [a, b];
const compareStrings = (a, b) => {
    if (isWildcard(a) || isWildcard(b))
        return 0;
    const [ap, bp] = forceType(tryParse(a), tryParse(b));
    if (ap > bp)
        return 1;
    if (ap < bp)
        return -1;
    return 0;
};
const compareSegments = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const r = compareStrings(a[i] || '0', b[i] || '0');
        if (r !== 0)
            return r;
    }
    return 0;
};

/**
 * Compare [semver](https://semver.org/) version strings to find greater, equal or lesser.
 * This library supports the full semver specification, including comparing versions with different number of digits like `1.0.0`, `1.0`, `1`, and pre-release versions like `1.0.0-alpha`.
 * @param v1 - First version to compare
 * @param v2 - Second version to compare
 * @returns Numeric value compatible with the [Array.sort(fn) interface](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#Parameters).
 */
const compareVersions = (v1, v2) => {
    // validate input and split into segments
    const n1 = validateAndParse(v1);
    const n2 = validateAndParse(v2);
    // pop off the patch
    const p1 = n1.pop();
    const p2 = n2.pop();
    // validate numbers
    const r = compareSegments(n1, n2);
    if (r !== 0)
        return r;
    // validate pre-release
    if (p1 && p2) {
        return compareSegments(p1.split('.'), p2.split('.'));
    }
    else if (p1 || p2) {
        return p1 ? -1 : 1;
    }
    return 0;
};

const INDEX_URL = "https://redist.ctr-electronics.com/index.json";
function getOwletPlatform(electronPlatform) {
    switch (electronPlatform) {
        case "mac-x64":
            return "macosuniversal";
        case "mac-arm64":
            return "macosuniversal";
        case "linux-x64":
            return "linuxx86-64";
        case "linux-arm64":
            return "linuxarm64";
        case "linux-armv7l":
            return "linuxarm32";
        case "win-x64":
            return "windowsx86-64";
        case "win-arm64":
            return "windowsx86-64";
        default:
            return "";
    }
}
async function downloadOwletInternal(target, platform, stableOnly = false) {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }
    const owletPlatform = getOwletPlatform(platform);
    const request = await fetch(INDEX_URL);
    const redistIndex = await request.json();
    if (redistIndex.JsonVersion !== "1.0.0.0")
        throw "Invalid JSON version";
    const owletIndex = redistIndex.Tools.find((tool) => tool.Name === "owlet");
    if (owletIndex === undefined)
        throw "Owlet not available in index";
    for (let i = 0; i < redistIndex.ChannelCompliancy.length; i++) {
        let compliancyName = redistIndex.ChannelCompliancy[i].Name.toLowerCase();
        if (stableOnly && (compliancyName.includes("beta") || compliancyName.includes("alpha"))) {
            continue;
        }
        let compatibleVersions = owletIndex.Items.filter((version) => version.Compliancy === redistIndex.ChannelCompliancy[i].Compliancy);
        compatibleVersions.sort((a, b) => -compareVersions(a.Version, b.Version));
        if (compatibleVersions.length > 0) {
            let downloadVersion = compatibleVersions[0];
            let filename = "owlet-" + downloadVersion.Version + "-C" + downloadVersion.Compliancy.toString();
            let tempFilename = filename + "-temp";
            if (platform.startsWith("win")) {
                filename += ".exe";
                tempFilename += ".exe";
            }
            if (owletPlatform in downloadVersion.Urls &&
                owletPlatform + "-sha1" in downloadVersion.Urls &&
                !fs.existsSync(path.join(target, filename))) {
                let existingFiles = await new Promise((resolve) => fs.readdir(target, (_, files) => resolve(files)));
                let toDelete = existingFiles.filter((filename) => filename.includes("-C" + downloadVersion.Compliancy.toString()));
                await download$1(downloadVersion.Urls[owletPlatform], target, { filename: tempFilename });
                let hash = crypto.createHash("sha1");
                hash.update(fs.readFileSync(path.join(target, tempFilename)));
                let hex = hash.digest("hex");
                if (hex === downloadVersion.Urls[owletPlatform + "-sha1"]) {
                    fs.chmodSync(path.join(target, tempFilename), 0o755);
                    toDelete.forEach((filename) => fs.unlinkSync(path.join(target, filename)));
                    fs.renameSync(path.join(target, tempFilename), path.join(target, filename));
                }
            }
        }
    }
}

function download(platform) {
    downloadOwletInternal(path.join("owlet", platform), platform, BETA_CONFIG === null).then(() => {
        console.log("Finished downloading for " + platform);
    });
}
console.log("Downloading owlet...");
download("mac-x64");
download("mac-arm64");
download("linux-x64");
download("linux-arm64");
download("linux-armv7l");
download("win-x64");
download("win-arm64");
