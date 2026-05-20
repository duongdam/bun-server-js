# Quickstart: Gemini embeddings (002)

1. Create a [Google AI Studio](https://aistudio.google.com/apikey) API key and set `GEMINI_API_KEY` in `.env`.
2. Set `EMBEDDING_PROVIDER=gemini` and `EMBEDDING_MODEL` to your chosen Gemini embedding model (default: `gemini-embedding-2`, truncated to `EMBEDDING_DIMENSION` / 768 for pgvector).
3. Set `EMBEDDING_DIMENSION` to the model output size, then run:

   ```bash
   bun run db:sync-embedding-dimension
   ```

   Or apply the migration generated per `tasks.md` before indexing new data.

4. Re-index any documents that were embedded with a different provider or dimension.

5. Run unit tests:

   ```bash
   bun run test:unit
   ```
