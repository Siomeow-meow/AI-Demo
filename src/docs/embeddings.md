# Embeddings and Vector Search

An embedding turns text into a list of numbers so that similar meanings end up close together. Vector search finds the chunks whose embeddings are nearest to the query embedding, usually using cosine similarity.

Production systems use neural embedding models and a vector database. Simpler systems use keyword scoring such as TF-IDF or BM25, which weigh rare words more heavily than common ones. This demo uses TF-IDF with cosine similarity so it runs entirely in your browser.
