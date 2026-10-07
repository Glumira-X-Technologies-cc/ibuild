# GluMira Chat and Production Builder

One local page. Two layers.

The first layer is a chat with an ask-before-answer prompt compiler. It does not reply to your idea with a build. It asks sharp clarifying questions first, then compiles your answers into one structured prompt you can paste into any AI tool.

The second layer is a multi-page workspace behind that chat: Ideas, Today, Diary, Library, Build list, Structure, Estate, Modules, Prompt kit, Evidence, Conscience, Resources.

The whole thing runs on your own machine, binds to `127.0.0.1` only, and talks to any OpenAI-compatible chat endpoint. Gemini is the default lane. Nothing leaves your computer except the model calls you configure.

## What the server does

Four jobs, one file.

1. Serves the page at `/`. `/index.html` and `/builder` serve the same page, so old bookmarks keep working.
2. `POST /api/chat` is the chat backend. It prepends the compiler system prompt, streams the reply as SSE, and holds the conversation history the browser sends.
3. `POST /api/lane` is the general model bridge. The builder's Prompt Kit agent, the Debug button, and the Ask box on each page call it. Same model path as `/api/chat`, but the caller supplies the full prompt and can ask for a JSON reply.
4. `/v1/chat/completions` and `/v1/models` are an OpenAI-compatible surface. Point Cursor, Aider, the OpenAI SDK, or any other OpenAI-speaking tool at `http://127.0.0.1:3001/v1` and it will use this server as its provider.

## Requirements

- Node.js 20 or newer
- An API key for any OpenAI-compatible chat service. Examples that work as-is:
  - Google Gemini, at `https://generativelanguage.googleapis.com/v1beta/openai`
  - NVIDIA NIM, at `https://integrate.api.nvidia.com/v1`
  - OpenAI itself, at `https://api.openai.com/v1`
  - Any other service that speaks the same protocol

## Quick start

```bash
npm install
