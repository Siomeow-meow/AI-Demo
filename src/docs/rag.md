# What is RAG?

Retrieval-Augmented Generation (RAG) combines a retriever with a language model. Instead of relying only on what the model memorised during training, the system first searches a knowledge base for passages relevant to the question.

The retrieved passages are placed into the prompt as context, and the model writes an answer grounded in them. This reduces hallucination and lets you update knowledge without retraining the model.

A typical RAG pipeline has four steps: split documents into chunks, index the chunks, retrieve the top matches for a query, and generate an answer that cites the retrieved chunks.
