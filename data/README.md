# Factory Data

This directory contains versioned factory assets used by GRAPH1KS Prompt Control Deck.

Expected primary assets:

- `GRAPH1KS_GENRE_MAP_FACTORY.json`
- `GRAPH1KS_PUBLIC_VAULT_FACTORY.json.gz`

## Public Vault format

The Public Vault factory database is stored as gzip-compressed JSON on purpose.

Rules:

- keep the canonical repository asset compressed as `.json.gz`;
- do not commit a second uncompressed copy unless explicitly required for a specific migration or debugging task;
- the extension should load and decompress the gzip asset client-side;
- validate parsed data before replacing an existing factory dataset;
- never overwrite user-created Private Vault data while importing or restoring factory data.

## Public Vault provenance

The Public Vault was created through a multi-stage research and synthesis workflow. Historical chart/reference material was used to identify artists and recordings to research; factual and descriptive musical characteristics were then researched and synthesized into new structured prompts and instrumental-arrangement descriptions.

`reference_artist` and `reference_song` are provenance/catalog metadata only. They identify the research target but are not intended to be passed into song-generation steps as artist-name or song-title imitation instructions.

Inside `instrumental_arrangement`, terms such as `source`, `original motif`, `original register`, or similar wording refer to the generated structured prompt and the musical concept established inside that database entry — not to the melody, performance, or recording named by `reference_song`.

See [`../docs/DATA_PROVENANCE.md`](../docs/DATA_PROVENANCE.md) for the full provenance, third-party-reference, and licensing-scope policy.

## Genre map

The genre map is a canonical application asset. Imports or replacements should validate schema integrity, canonical names, duplicate/collision behavior and allowed major/subgenre relationships before activation.

## Third-party material

Artist names, song titles, trademarks, and similar identifiers may appear as reference metadata. Their inclusion is for identification and provenance only and does not imply affiliation, endorsement, sponsorship, or ownership by Graph1ks.

Do not add unlicensed copies of lyrics, sound recordings, notation, artwork, editorial reviews, raw chart-history databases, or other substantial third-party datasets merely because they are publicly accessible.

## Licensing

Making a factory data file publicly accessible in this repository does not grant commercial-use rights beyond those expressly granted by the repository's license or another license that accompanies a specific dataset.

Unless a dataset states otherwise, the repository's PolyForm Noncommercial licensing model applies to project-authored factory assets only to the extent Graph1ks has rights to license them.

Third-party names, metadata, references, trademarks, recordings, compositions, or other third-party material remain subject to their own rights and are not relicensed merely by inclusion or reference in this repository.
