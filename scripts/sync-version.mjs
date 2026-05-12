#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf8"));
}

function writeJsonPreservingFormat(path, obj) {
	writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`);
}

const rootPath = resolve(ROOT, "package.json");
const rootPkg = readJson(rootPath);
const version = rootPkg.version;

if (typeof version !== "string" || !SEMVER_RE.test(version)) {
	console.error(`[sync-version] root package.json has no valid semver "version" (got: ${JSON.stringify(version)})`);
	process.exit(1);
}

const targets = [
	resolve(ROOT, "backend/package.json"),
	resolve(ROOT, "frontend/package.json"),
];

let changed = 0;
for (const target of targets) {
	const pkg = readJson(target);
	if (pkg.version === version) {
		console.log(`[sync-version] ${target} already at ${version}`);
		continue;
	}
	const previous = pkg.version;
	pkg.version = version;
	writeJsonPreservingFormat(target, pkg);
	console.log(`[sync-version] ${target}: ${previous} -> ${version}`);
	changed++;
}

console.log(`[sync-version] done — root=${version}, ${changed} workspace(s) updated`);
