import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { assistantRoutes } from "../../src/features/assistant/routes";

test("every navigable website route has assistant access metadata", async () => {
	const source = await readFile("src/routeTree.gen.ts", "utf8");
	const interfaceBody = source.match(
		/export interface FileRoutesByFullPath \{([\s\S]*?)\n\}/,
	)?.[1];
	assert.ok(interfaceBody, "FileRoutesByFullPath was not found");
	const generatedPaths = [...interfaceBody.matchAll(/^\s+'([^']+)'/gm)]
		.map((match) => match[1]?.replace(/\/$/, "") || "/")
		.filter((path) => !path.startsWith("/api/"));
	const registeredPaths = new Set(assistantRoutes.map((route) => route.path));
	const redirectOnlyRoutes = new Set(["/services/$authoritySlug/form/$formId"]);
	const missing = [...new Set(generatedPaths)].filter(
		(path) => !registeredPaths.has(path) && !redirectOnlyRoutes.has(path),
	);
	assert.deepEqual(missing, []);
});

test("assistant destinations are unique and sensitive workspace pages require auth", () => {
	assert.equal(
		new Set(assistantRoutes.map((route) => route.destination)).size,
		assistantRoutes.length,
	);
	for (const path of [
		"/dashboard",
		"/services",
		"/drafts",
		"/continuation",
		"/grievances",
		"/grievances/$registrationId",
	]) {
		assert.equal(
			assistantRoutes.find((route) => route.path === path)?.access,
			"authenticated",
		);
	}
});
