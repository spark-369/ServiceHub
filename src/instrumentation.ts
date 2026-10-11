/**
 * Next.js instrumentation hook (runs once per server process, before the app
 * starts handling traffic).
 *
 * This file must remain free of Node.js-only APIs (`process.exit`, `process.on`,
 * …) because Next.js also compiles it for the Edge runtime. The Node-specific
 * logic lives in `./instrumentation.node` and is imported dynamically — and
 * only in the Node.js runtime — so the Edge bundler never sees those APIs.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { registerNodeInstrumentation } = await import(
    "./instrumentation.node"
  );
  await registerNodeInstrumentation();
}

