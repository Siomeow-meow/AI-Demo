# Evaluating RAG Systems

Evaluate retrieval and generation separately. For retrieval, measure recall at k: how often the correct passage appears in the top k results. For generation, check faithfulness (does the answer stay within the retrieved context) and relevance (does it answer the question).

Build a small test set of questions with known source passages, and re-run it whenever you change the chunk size, embedding model, or prompt.
