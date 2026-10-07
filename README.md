# ibuild
my production builder

One local page. Two layers.

The first layer is a chat with an ask-before-answer prompt compiler. It does not reply to your idea with a build. It asks sharp clarifying questions first, then compiles your answers into one structured prompt you can paste into any AI tool.

The second layer is a multi-page workspace behind that chat: Ideas, Today, Diary, Library, Build list, Structure, Estate, Modules, Prompt kit, Evidence, Conscience, Resources.

The whole thing runs on your own machine, binds to `127.0.0.1` only, and talks to any OpenAI-compatible chat endpoint. Gemini is the default lane. Nothing leaves your computer except the model calls you configure.

## What is in this repo

```
.
├── server.js                 Local server. Serves the page. Proxies model calls.
├── index.html                The page. Chat is its first tab.
├── production-builder/       Builder source, if the page is built from parts.
│   └── index.html
├── package.json              One dependency: express.
├── .gitignore
└── README.md
```

If the page is served from a single file, `index.html` at the root is what runs. If it is built from `production-builder/`, `server.js` finds it and serves it at the same URL. Only one of the two is the live page; the other is either the source or a copy. Check `server.js` to see which it serves.

## What the server does

Four jobs, one file.

1. Serves the page at `/`. `/index.html` and `/builder` serve the same page, so old bookmarks keep working.
2. `POST /api/chat` is the chat backend. It prepends the compiler system prompt, streams the reply as SSE, and holds the conversation history that the browser sends.
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
```

Set your key. Two ways, pick one.

**Environment variable, per shell session:**

```bash
export PROVIDER_API_KEY="your-key-here"
export PROVIDER_BASE_URL="https://generativelanguage.googleapis.com/v1beta/openai"
export PROVIDER_MODEL="gemini-2.5-flash"
node server.js
```

**Or a local credentials file** named `credentials.env` in the same folder. It is excluded by `.gitignore`. Format:

```
PROVIDER_API_KEY=your-key-here
PROVIDER_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
PROVIDER_MODEL=gemini-2.5-flash
```

Then:

```bash
node server.js
```

Open `http://127.0.0.1:3001/`. The page opens on the Chat tab.

## Port

The server listens on `3001` by default. Change it with `PORT`:

```bash
PORT=3002 node server.js
```

If the port is already in use, the server exits with a clear message instead of silently failing.

## The chat

The chat is the front door, and it is the whole point of this repo.

Type an idea. Press Enter. The compiler replies with a numbered list of clarifying questions, not a build. Answer the questions and send your answers. It then replies with one structured prompt:

```
<role>...</role>
<context>...</context>
<task>...</task>
<constraints>- ...</constraints>
<done_when>...</done_when>
```

Copy that block into any AI tool. The chat does not answer the idea, does not write code, and does not file a diary entry. It compiles.

The behavior comes from a single system prompt in `server.js`. If the reply looks like prose instead of questions, the prompt did not load. Confirm `server.js` is the current version and hard reload the page (Ctrl+Shift+R).

Two small rules the compiler holds to:

- It never repeats a question it has already asked.
- It picks the model, tools, and skills itself, states the pick inside `<context>`, and never asks the user to choose a tool.

## The builder

Behind the chat, a set of tabs handle longer work.

- **Ideas**: type an idea, press Take it further. The builder reads your build list, asks up to three questions, keeps your words verbatim, and shows a confidence score. Copy of a prompt opens when the score reaches 98 percent.
- **Prompt Kit**: a six-step form (job type, goal, add-ons, model, skills, copy). Typing a Goal triggers an agent that fills the other fields and picks a model, skills, and add-ons. Click any chip to override.
- **Build list**, **Today**, **Diary**: read-only views of a roadmap and a task ledger, when those are supplied.
- **Library**, **Structure**, **Estate**: the filing structure the workspace uses, drawn as a tree.
- **Modules**, **Resources**, **Evidence**, **Conscience**: reference pages and logs.

Every AI feature on the builder calls `POST /api/lane` on the same server. If the lane is not reachable, the page says so in plain words and sends nothing.

## Using this server from other tools

Because the server speaks the OpenAI chat completions protocol, any tool that accepts a custom base URL can use it.

**Cursor, Aider, Cline, or any OpenAI SDK:**

```
Base URL:  http://127.0.0.1:3001/v1
API key:   anything non-empty (the server already holds the real key)
Model:     the model name you set in PROVIDER_MODEL
```

**From a shell:**

```bash
curl http://127.0.0.1:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"say ok"}]}'
```

**Streaming:**

```bash
curl -N http://127.0.0.1:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-2.5-flash","messages":[{"role":"user","content":"count to three"}],"stream":true}'
```

## Configuration reference

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PROVIDER_API_KEY` | yes | none | Key for your model provider |
| `PROVIDER_BASE_URL` | no | Gemini OpenAI endpoint | Base URL of the provider |
| `PROVIDER_MODEL` | no | `gemini-2.5-flash` | Model name sent to the provider |
| `PORT` | no | `3001` | Local port the server binds to |

The server never prints a full key. On startup it logs a masked form, for example `AIzaSxxxx...f9Q2`.

## Security model

- The server binds to `127.0.0.1` only. It is not reachable from other machines on your network.
- A request whose `Host` header is not `127.0.0.1` or `localhost` is refused. This blocks DNS rebinding attacks from a browser tab.
- A request with a foreign `Origin` header is refused. This stops another website from spending your key through the browser.
- No key is ever written into HTML, into the browser, or into a log. The key lives only in the process environment or in the `credentials.env` file you control.
- Never commit `credentials.env`. The `.gitignore` in this repo excludes it and every other `.env` file. If you fork, verify your own ignore rules before pushing.

## Running as a service on Windows

To start the server with the machine and restart on failure, register it as a Windows service.

```powershell
nssm install GluMiraProxy "C:\Program Files\nodejs\node.exe" "C:\path\to\server.js"
nssm set GluMiraProxy AppDirectory "C:\path\to"
nssm set GluMiraProxy Start SERVICE_AUTO_START
nssm start GluMiraProxy
```

`nssm` is the Non-Sucking Service Manager. It runs the process in the background with no console window and restarts it on crash.

For a foreground-only setup, a batch file in the Startup folder is enough. It runs only while you are logged in.

## What this repo does not include

- No clinical content.
- No model weights.
- No database. State that survives a reload lives in the browser's `localStorage`, keyed by page.
- No secrets. Every key is supplied at runtime by you.

## Known limits

- One feature in the builder (a save-and-promote block used inside a desktop chat app) is inert when the page is opened in a plain browser. Every other feature works.
- The compiler writes prompts in English. Nothing here is localized.
- Streaming is one-way. The server streams model output to the browser; it does not stream the browser's input back.

## License

Add a license file before publishing. MIT is a reasonable default for a repo of this shape.

## Contributing

Open an issue describing the change you want before opening a pull request. Small pull requests with a clear diff are easier to review than large ones.

No credit lines in commit messages. Sign-off is not required.
```
