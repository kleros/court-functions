# Kleros Court Functions

### `put-justification`

- Checks the justification signature for validity and adds the justification to the database
    - Address recovered from signature must be valid and the corresponding votes must not have been casted.
- If it receives `derivedSignature`  it adds it to the derived account database

### `get-justification`

- Returns justifications for corresponding dispute round

### `get-dispute-metaevidence`

- Fetches metaevidence uri from subgraph or database
- Often the metaevidence uri is emitted before any interaction with KlerosLiquid. Thus the subgraph will not be able to index it
    - When this is the case, metaevidence uri from database is fetched. This is because `getLogs` calls take long (too long for a simple serverless function to handle) and are not very reliable so we cache the uris on Supabase.
    - When a new uri is fetched but not found in the database (because it has not been yet introduced), we call the `notice-metaevidence-background` bg function

### `notice-metaevidence-background`

- fetches the metaevidence uri via `getLogs` and introduces it into the database
    - uses multiple batches for faster concurrent fetching

### `upload-to-ipfs`
- uploads a files to ipfs and returns the cids.
- returned cid has the scheme : `/ipfs/cid`