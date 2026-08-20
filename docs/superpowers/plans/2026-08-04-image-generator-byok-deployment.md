# Image Generator BYOK Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept session-scoped user API credentials, use them for image jobs without persistence, and deploy the working Next.js application through `ai-deploy`.

**Architecture:** A focused credential parser validates request headers and compatible endpoint URLs. The browser stores credentials in `sessionStorage`; the server keeps a job's credentials in a private in-memory map only until that job reaches a terminal state.

**Tech Stack:** Next.js 16, React 19, TypeScript, OpenAI SDK, Vitest, ai-deploy MCP

---

### Task 1: Parse And Validate BYOK Credentials

**Files:**
- Create: `projects/image-generator/src/lib/openai-credentials.ts`
- Create: `projects/image-generator/src/lib/openai-credentials.test.ts`

- [ ] **Step 1: Write failing parser tests**

Cover a trimmed key, a blank key, the official endpoint default, normalized HTTPS URLs, malformed URLs, URL credentials, localhost, loopback, private IPv4 literals, and non-HTTPS URLs.

```ts
expect(parseOpenAICredentials(new Headers({ "x-openai-api-key": " sk-test " }))).toEqual({
  ok: true,
  data: { apiKey: "sk-test", baseURL: undefined },
});
expect(parseOpenAICredentials(new Headers())).toEqual({
  ok: false,
  error: "请输入 API Key。",
});
expect(parseOpenAICredentials(new Headers({
  "x-openai-api-key": "sk-test",
  "x-openai-base-url": "http://127.0.0.1:3000/v1",
}))).toEqual({ ok: false, error: "API 地址必须使用 HTTPS。" });
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- src/lib/openai-credentials.test.ts`

Expected: FAIL because `openai-credentials.ts` does not exist.

- [ ] **Step 3: Implement the credential parser**

Export `OpenAICredentials` and `parseOpenAICredentials(headers: Headers)`. Use `URL` for parsing, require `https:`, reject `username` or `password`, and reject `localhost`, `.localhost`, IPv4 loopback, link-local, and RFC1918 literals. Return the normalized URL without a trailing slash.

- [ ] **Step 4: Verify the parser tests pass**

Run: `npm test -- src/lib/openai-credentials.test.ts`

Expected: all credential parser tests PASS.

- [ ] **Step 5: Commit the parser**

```bash
git add projects/image-generator/src/lib/openai-credentials.ts projects/image-generator/src/lib/openai-credentials.test.ts
git commit -m "feat: validate BYOK OpenAI credentials"
```

### Task 2: Bind Credentials To Image Job Lifetime

**Files:**
- Modify: `projects/image-generator/src/lib/image-job-store.ts`
- Modify: `projects/image-generator/src/lib/image-job-store.test.ts`

- [ ] **Step 1: Write failing job credential tests**

Change test job creation to pass `{ apiKey: "test-key", baseURL: "https://example.test/v1" }`. Assert the public job JSON excludes the key, OpenAI receives those options, and a test helper reports that credentials disappear after success, failure, and reset.

```ts
expect(JSON.stringify(job)).not.toContain("test-key");
expect(__hasImageJobCredentialsForTests(job.id)).toBe(true);
await runImageJob(job.id);
expect(OpenAI).toHaveBeenCalledWith({ apiKey: "test-key", baseURL: "https://example.test/v1" });
expect(__hasImageJobCredentialsForTests(job.id)).toBe(false);
```

- [ ] **Step 2: Verify the job tests fail**

Run: `npm test -- src/lib/image-job-store.test.ts`

Expected: FAIL because `createImageJob` does not accept credentials and the helper is absent.

- [ ] **Step 3: Implement private credential storage**

Add `imageJobCredentials = new Map<string, OpenAICredentials>()`. Require credentials in `createImageJob`, read them in `runImageJob`, and delete them in both terminal state functions. Keep credentials out of `ImageJob`.

- [ ] **Step 4: Verify the job tests pass**

Run: `npm test -- src/lib/image-job-store.test.ts`

Expected: all image job store tests PASS.

- [ ] **Step 5: Commit job credential handling**

```bash
git add projects/image-generator/src/lib/image-job-store.ts projects/image-generator/src/lib/image-job-store.test.ts
git commit -m "feat: scope BYOK credentials to image jobs"
```

### Task 3: Add Session Storage And Credential Controls

**Files:**
- Create: `projects/image-generator/src/lib/session-credentials.ts`
- Create: `projects/image-generator/src/lib/session-credentials.test.ts`
- Modify: `projects/image-generator/src/lib/ui-copy.ts`
- Modify: `projects/image-generator/src/lib/ui-copy.test.ts`
- Modify: `projects/image-generator/src/app/page.tsx`
- Modify: `projects/image-generator/src/app/globals.css`

- [ ] **Step 1: Write failing session storage tests**

Test `loadSessionCredentials(storage)` and `saveSessionCredentials(storage, credentials)` with an in-memory `Storage` substitute. Assert that both fields round-trip and empty base URLs remove their storage key.

```ts
saveSessionCredentials(storage, { apiKey: "sk-test", baseURL: "https://gateway.test/v1" });
expect(loadSessionCredentials(storage)).toEqual({
  apiKey: "sk-test",
  baseURL: "https://gateway.test/v1",
});
```

- [ ] **Step 2: Verify the storage tests fail**

Run: `npm test -- src/lib/session-credentials.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement session storage helpers**

Use namespaced keys `image-generator:openai-api-key` and `image-generator:openai-base-url`. Accept `Pick<Storage, "getItem" | "setItem" | "removeItem">` so tests do not require a browser DOM.

- [ ] **Step 4: Add the credential form**

Add `apiKey` and `baseURL` state. Load it once from `sessionStorage`, save changes through the helper, render a password input and URL input above the prompt, and send both headers for JSON and multipart job creation. Disable submission when loading or when the trimmed API key is empty.

```ts
const credentialHeaders = {
  "X-OpenAI-API-Key": apiKey.trim(),
  ...(baseURL.trim() ? { "X-OpenAI-Base-URL": baseURL.trim() } : {}),
};
```

Add Chinese labels and hints to `UI_COPY`. Style text, password, and URL inputs with the existing field styles; do not introduce a new panel or nested card.

- [ ] **Step 5: Verify UI copy and storage tests pass**

Run: `npm test -- src/lib/session-credentials.test.ts src/lib/ui-copy.test.ts`

Expected: both test files PASS.

- [ ] **Step 6: Commit the browser BYOK controls**

```bash
git add projects/image-generator/src/lib/session-credentials.ts projects/image-generator/src/lib/session-credentials.test.ts projects/image-generator/src/lib/ui-copy.ts projects/image-generator/src/lib/ui-copy.test.ts projects/image-generator/src/app/page.tsx projects/image-generator/src/app/globals.css
git commit -m "feat: add session-scoped BYOK controls"
```

### Task 4: Apply Credential Parsing To API Routes

**Files:**
- Modify: `projects/image-generator/src/app/api/jobs/route.ts`
- Modify: `projects/image-generator/src/app/api/generate-image/route.ts`

- [ ] **Step 1: Add parser calls to both routes**

Call `parseOpenAICredentials(request.headers)` after body validation. Return its error with HTTP 400. Pass parsed credentials to `createImageJob` and construct the legacy route's OpenAI client from the parsed values. Remove the server environment-variable checks.

```ts
const credentials = parseOpenAICredentials(request.headers);
if (!credentials.ok) {
  return NextResponse.json({ error: credentials.error }, { status: 400 });
}
```

- [ ] **Step 2: Run focused and full tests**

Run: `npm test`

Expected: all Vitest files PASS without warnings.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Next.js completes successfully and lists `/api/jobs`, `/api/jobs/[jobId]`, and `/api/generate-image` as dynamic routes.

- [ ] **Step 4: Commit route integration**

```bash
git add projects/image-generator/src/app/api/jobs/route.ts projects/image-generator/src/app/api/generate-image/route.ts
git commit -m "feat: use BYOK credentials in image APIs"
```

### Task 5: Deploy And Verify

**Files:**
- Modify if needed: `projects/image-generator/README.md`

- [ ] **Step 1: Document BYOK operation**

Replace required server `.env.local` setup with the deployed BYOK behavior while retaining optional local environment instructions only if the code still supports them.

- [ ] **Step 2: Run final verification**

Run: `npm test && npm run build`

Expected: tests and build PASS. Run `git diff --check` and expect no output.

- [ ] **Step 3: Commit documentation**

```bash
git add projects/image-generator/README.md
git commit -m "docs: explain BYOK image generation"
```

- [ ] **Step 4: Push the implementation**

Push the current `main` branch to `origin`. The existing backend source points at the GitHub `main/projects/image-generator` path, so check that deployment first. If that source form fails, create and push a deployment branch whose root is the `projects/image-generator` subtree, then create a replacement backend from that branch.

- [ ] **Step 5: Verify the deployed service**

Check the backend URL for HTTP success. Submit a request without `X-OpenAI-API-Key` and expect HTTP 400 with `请输入 API Key。`. Query `ai-deploy` quota after deployment. Do not run a paid image generation call without an explicit test key.
