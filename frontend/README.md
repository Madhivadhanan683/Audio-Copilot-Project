# Audio Copilot frontend

## Deploy to Vercel

1. Import this repository into Vercel and set the **Root Directory** to `frontend`.
2. Keep the framework preset as **Vite**. Vercel will run the `build` script and publish `dist`.
3. Set `VITE_API_URL` to the public HTTPS origin of your separately deployed backend (for example, `https://your-api.example.com`), without a trailing slash. Set it for each Vercel environment and redeploy.

The `vercel.json` rewrite serves the Vite app for client-side routes. The frontend uses `VITE_API_URL` for HTTP and WebSocket requests; during local development, Vite proxies `/api` and `/ws` to `http://localhost:8000`.

The FastAPI backend is not deployed by this Vercel configuration. It uses persistent in-memory state, WebSockets, local file storage, and audio/ML dependencies, so host it separately on a service that supports long-running Python processes, WebSockets, and persistent/object storage. Ensure the backend has an HTTPS/WSS public URL and allows your Vercel site's origin through CORS if you restrict cross-origin requests.

`VITE_API_URL` is embedded during the frontend build. Redeploy after changing it.

## Local development

Run the backend on port 8000, set `VITE_API_URL=http://localhost:8000` in a local `.env` file if you want to bypass Vite's development proxy, then run `npm ci` and `npm run dev` from this directory.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
