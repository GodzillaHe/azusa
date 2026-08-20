# Image Generator BYOK Deployment Design

## Goal

Deploy `projects/image-generator` to the user's AI application space through the
`ai-deploy` MCP service. The deployed application must accept a user-provided
OpenAI API key and an optional OpenAI-compatible API base URL. It must not
require a platform-managed `OPENAI_API_KEY`.

## Scope

This change covers BYOK credential input, temporary credential handling,
request validation, automated tests, and deployment packaging. It keeps the
existing image generation, image editing, polling, history, and export flows.

The work does not add user accounts, shared credential storage, database
persistence, or a general secret-management service.

## Credential UI

The generation form will include:

- A required API key password input.
- An optional API base URL input for OpenAI-compatible gateways.

The browser will store both values in `sessionStorage`. A page refresh in the
same tab restores them. Closing the tab clears them. The UI will not copy either
value into image history, URLs, analytics, or error messages.

The submit button will remain unavailable until the prompt and API key pass
client-side validation. Existing loading and duplicate-submission behavior will
remain unchanged.

## Request Protocol

The browser will send credentials only when it starts an image job:

- `X-OpenAI-API-Key`: the user-provided API key.
- `X-OpenAI-Base-URL`: the optional compatible endpoint.

Headers work for both JSON generation requests and multipart image-edit
requests. Polling requests do not need credentials.

The existing `/api/jobs` endpoint will parse and validate these headers before
creating a job. The older `/api/generate-image` endpoint will use the same
credential parser so both server entry points follow one contract.

## Server Credential Lifetime

The job store will keep credentials in a private in-memory map keyed by job ID.
The public job record will not contain credentials. `runImageJob` will read the
credentials when it creates the OpenAI client.

The server will delete credentials after success or failure. Test reset helpers
will clear the credential map as well. A process restart may discard active
jobs, matching the current in-memory job behavior.

## Validation And Security

The server will reject a missing or blank API key with HTTP 400.

For a custom base URL, the server will:

- Parse it with the standard `URL` API.
- Require the `https:` scheme.
- Reject embedded usernames and passwords.
- Reject localhost, loopback, link-local, and private-network IP literals.
- Normalize the accepted URL before passing it to the OpenAI client.

These rules reduce server-side request forgery risk on a publicly reachable
deployment. Users can leave the field blank to use the official OpenAI API.

The application will not log credential headers or include them in API
responses. The deployment ZIP and Git history will not contain a real key.

## Tests

Unit tests will cover:

- Required API key parsing and whitespace handling.
- Optional base URL normalization.
- Rejection of malformed, non-HTTPS, credential-bearing, local, and private IP
  URLs.
- Credential availability while a job runs.
- Credential deletion after job success, failure, and test reset.

The final verification will run the full Vitest suite and a production Next.js
build.

## Deployment

The application needs a Node.js server because it exposes dynamic Next.js API
routes. Static ZIP deployment alone cannot support image generation.

The deployment source must place `projects/image-generator` at the source root. The
release process will create a dedicated Git deployment branch from that
subdirectory and push it to the existing GitHub repository. `ai-deploy` will use
that branch as the backend source. If the platform cannot select a branch from
the repository URL, the fallback is a container image built from the same
source tree.

After deployment, verification will check the public page, validation for a
missing key, and job creation with BYOK credentials. A live paid image
generation call will only run when a user-provided key is available for that
check.
