# Backend

All backend code for Banana lives in this folder.

## What goes here

- **Store connectors**: one module per store that fetches items and prices and returns them in one shared format.
- **Database layer**: the code that saves prices to and reads prices from the database (Supabase / Postgres).
- **Filters**: search by item, store, parent company, distance, and member vs non-member price.

## Notes

- Written in TypeScript, the same language as the front end.
- The front end will connect to this later, so shared types and filters should be easy to import.
- Never commit secrets. Keys go in a local `.env` file, which is already ignored by git.
