import { pipeline, env as transformersEnv } from "@huggingface/transformers";
import { logger } from "@/lib/config/logger";

/**
 * Local embedding-based semantic search.
 *
 * The model is downloaded at runtime on first use. In restricted/offline
 * environments that fetch can fail; every public helper therefore degrades
 * gracefully instead of throwing so a search request never 500s because of an
 * unavailable AI model.
 */

// Cache the extractor (and a failed-load flag) across requests.
let extractor: any = null;
let extractorLoadFailed = false;

// Keep the cache inside the project so serverless/standalone deployments have
// a writable location; transformers.js defaults to the CWD otherwise.
transformersEnv.cacheDir = process.env.TRANSFORMERS_CACHE || "./.cache";

async function loadExtractor() {
  if (extractorLoadFailed) return null;
  if (!extractor) {
    try {
      extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2"
      );
    } catch (error) {
      extractorLoadFailed = true;
      logger.warn("Failed to load embedding model; AI search disabled", {
        error,
      });
      return null;
    }
  }
  return extractor;
}

export async function generateEmbeddings(text: string): Promise<number[]> {
  const model = await loadExtractor();
  if (!model) {
    throw new Error("Embedding model unavailable");
  }
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

export async function calculateSimilarity(
  embedding1: number[],
  embedding2: number[]
): Promise<number> {
  if (embedding1.length !== embedding2.length) {
    throw new Error("Embeddings must have the same length");
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) return 0;

  return dotProduct / (norm1 * norm2);
}

/**
 * Rank `serviceDescriptions` by semantic similarity to `userQuery`.
 *
 * Returns one score per description. If the model is unavailable, falls back
 * to a cheap lexical (token-overlap) score so callers still get a sensible
 * ordering rather than an error.
 */
export async function recommendServices(
  userQuery: string,
  serviceDescriptions: string[]
): Promise<number[]> {
  if (serviceDescriptions.length === 0) return [];

  const model = await loadExtractor();
  if (!model) {
    return lexicalSimilarities(userQuery, serviceDescriptions);
  }

  try {
    const queryEmbedding = await generateEmbeddings(userQuery);
    const similarities: number[] = [];

    for (const description of serviceDescriptions) {
      const serviceEmbedding = await generateEmbeddings(description);
      similarities.push(
        await calculateSimilarity(queryEmbedding, serviceEmbedding)
      );
    }

    return similarities;
  } catch (error) {
    logger.warn("Embedding search failed; using lexical fallback", { error });
    return lexicalSimilarities(userQuery, serviceDescriptions);
  }
}

/** Token-overlap fallback scoring (0..1), fully deterministic and offline. */
function lexicalSimilarities(
  userQuery: string,
  serviceDescriptions: string[]
): number[] {
  const tokenise = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 1)
    );

  const queryTokens = tokenise(userQuery);
  if (queryTokens.size === 0) return serviceDescriptions.map(() => 0);

  return serviceDescriptions.map((description) => {
    const tokens = tokenise(description);
    if (tokens.size === 0) return 0;
    let overlap = 0;
    for (const token of queryTokens) {
      if (tokens.has(token)) overlap += 1;
    }
    return overlap / queryTokens.size;
  });
}
