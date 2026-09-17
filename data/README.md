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

## Genre map

The genre map is a canonical application asset. Imports or replacements should validate schema integrity, canonical names, duplicate/collision behavior and allowed major/subgenre relationships before activation.

## Licensing

Making a factory data file publicly accessible in this repository does not grant commercial-use rights beyond those expressly granted by the repository's license or another license that accompanies a specific dataset.

Unless a dataset states otherwise, the repository's PolyForm Noncommercial licensing model applies to project-authored factory assets to the extent Graph1ks has rights to license them.

Third-party names, metadata, references or other material contained in a dataset may remain subject to separate rights and are not relicensed merely by inclusion in this repository.
