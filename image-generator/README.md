# Image Generator

A standalone Next.js app for generating images with `gpt-image-2`.

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=your_optional_base_url
```

If you use the default OpenAI endpoint, leave `OPENAI_BASE_URL` empty.

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
