# Image Generator

A standalone Next.js app for generating images with `gpt-image-2`.

## Setup

```bash
npm install
```

The app uses BYOK credentials. Enter an OpenAI API key in the page before
starting an image job. You can also enter an OpenAI-compatible HTTPS base URL.

The browser stores both values in `sessionStorage`. They remain available after
a refresh in the same tab and are cleared when the tab closes. The server keeps
the credentials in memory only while the image job runs.

## Run

```bash
npm run dev
```

Open http://localhost:3000.

## Verify

```bash
npm test
npm run build
```
