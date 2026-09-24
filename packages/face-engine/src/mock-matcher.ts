/**
 * Mock Face Matcher — FOR TESTING ONLY.
 *
 * Uses cosine similarity on the mock embeddings.
 * This is mathematically correct but uses random embeddings,
 * so it will NOT produce meaningful recognition results.
 */

import type { ComparisonInput } from '@medu/core';

export class MockMatcher {
  async compareEmbeddings(input: ComparisonInput): Promise<number> {
    return input.embeddingA.cosineSimilarity(input.embeddingB);
  }
}
