# Data Provenance and Third-Party References

This document describes how the GRAPH1KS Prompt Control Deck Public Vault was researched and generated, what the reference fields mean, and which rights are — and are not — claimed by this repository.

It is provenance and project-policy documentation. It does not grant rights in third-party material and does not replace the terms, licenses, or legal rights that may apply to external research sources.

## Public Vault creation pipeline

The Public Vault was built as a multi-stage research and synthesis dataset.

### 1. Research-set selection

Historical chart information and other publicly accessible music-reference material were used to identify artists and recordings worth researching across different years and eras.

The working lists created during this stage were research-priority lists — for example, “Top 100 Artists to Research” for a given year. They were not represented as an official Billboard artist ranking, and the Public Vault is not intended to redistribute complete weekly Billboard charts, chart-run histories, or another provider's raw chart database.

Artist names and song titles retained from this stage are catalog/provenance identifiers for the research target.

### 2. Factual and descriptive music research

For each research target, factual and descriptive characteristics were researched from multiple public music-reference sources and web research. Depending on the entry, this may include information such as:

- release era/year;
- tempo/BPM;
- key or mode;
- genre and style classification;
- instrumentation;
- groove and rhythmic characteristics;
- production characteristics;
- arrangement characteristics;
- other factual or descriptive musical attributes.

No single external source is treated as the authored prompt text for the Public Vault. External material is used as research input rather than copied as the final prompt or arrangement text.

### 3. Independent prompt synthesis

ChatGPT was used to synthesize the researched characteristics into new structured prompt text for the database.

A typical entry contains fields such as:

- `genre`;
- `bpm`;
- `emotion`;
- `style`;
- `year`;
- `key`;
- `structured_prompt`;
- `negative_prompt`;
- `instrumental_arrangement`.

The generated `structured_prompt` is the musical concept used by later arrangement-generation steps.

### 4. Instrumental-arrangement expansion

The `instrumental_arrangement` field is generated from the already-created structured prompt and the musical concept established inside that database entry.

This distinction is important.

When an arrangement contains wording such as:

- “source phrase”;
- “original motif”;
- “original register”;
- “source form”;
- “unchanged lead identity”;
- “same structural points”;

those terms refer to the generated prompt/concept established for that entry. They do **not** instruct the system to copy, reconstruct, or preserve the melody, performance, recording, or other protected expression of the commercially released song named in `reference_song`.

## Meaning of `reference_artist` and `reference_song`

`reference_artist` and `reference_song` are provenance/catalog metadata only.

They identify the real-world recording that originally motivated the research entry so the dataset can be understood, organized, checked, and traced back to its research context.

By design, these fields are not song-creation instructions and are not used as artist-name or song-title imitation prompts. The generation workflow operates on the independently synthesized musical description contained in the prompt data.

Future changes must preserve this separation unless Graph1ks explicitly approves a different design and the associated licensing/legal implications have been reviewed.

## Third-party names, titles, and marks

Artist names, song titles, album titles, label names, trademarks, and other third-party identifiers are used only for identification, reference, and provenance.

Their inclusion does not imply affiliation with, sponsorship by, approval from, or endorsement by the referenced artists, labels, publishers, chart providers, platforms, or other rights holders.

Graph1ks does not claim ownership of third-party:

- artist or group names;
- song or album titles;
- trademarks or service marks;
- musical compositions;
- sound recordings;
- lyrics;
- cover artwork, photographs, or other artwork;
- other protected third-party material merely because it is referenced by metadata in the dataset.

## Factual metadata

Factual or descriptive metadata such as dates, tempo measurements, keys, instrumentation, genre labels, and similar research facts may be included as part of the database structure.

The repository does not claim exclusive ownership of underlying facts merely because they appear in a project-authored record. Rights are claimed only to the extent applicable to project-authored text, software, selection/organization, taxonomy work, transformations, and other protectable material for which Graph1ks holds the relevant rights.

## Material that should not be added without explicit rights review

The Public Vault should not contain unlicensed copies of third-party expressive or database material merely because that material is publicly accessible online.

In particular, maintainers should not add the following unless the project has a clear right to do so:

- complete song lyrics or substantial lyric excerpts;
- musical notation or transcriptions copied from protected works;
- sound recordings or samples;
- album covers, artist photographs, or other third-party artwork;
- copied editorial reviews or substantial passages from music-reference sites;
- complete raw weekly chart histories or bulk chart-provider databases;
- third-party metadata/tag dumps whose license does not permit redistribution;
- other substantial third-party datasets without checking their license and terms.

Public accessibility, a public API, a public GitHub repository, or a downloadable file does not by itself mean that redistribution rights have been granted.

## Chart-research distinction

Historical chart material was used as a discovery and prioritization input for research targets.

The project-generated research lists and Public Vault entries should not be described as official Billboard rankings unless they actually reproduce an official ranking under an appropriate right or license. Internal labels such as “Top 100 Artists to Research” describe the project's research prioritization rather than an official chart product.

The Public Vault should retain only the reference and project-authored information needed for its purpose rather than republishing raw chart-provider datasets.

## AI-generated and project-authored material

Structured prompts and instrumental-arrangement descriptions were generated/synthesized for this project from researched factual and descriptive inputs.

AI-generated material may not be unique, and copyrightability can vary by material and jurisdiction. The repository's licenses therefore apply only to the extent Graph1ks owns or is otherwise entitled to license the relevant rights.

Nothing in the repository license should be read as granting rights in third-party works or identifiers that Graph1ks does not own or control.

## Licensing scope

The PolyForm Noncommercial License and any separately negotiated commercial license apply only to rights that Graph1ks is legally able to grant.

They do not grant permission to use third-party trademarks, recordings, compositions, lyrics, artwork, databases, or other third-party material beyond whatever permission is independently available to the user under applicable law or a separate license.

## Maintenance rules

When changing the Public Vault or its generation pipeline:

1. keep `reference_artist` and `reference_song` separate from actual song-generation instructions;
2. preserve the meaning of “source/original” inside arrangement text as a reference to the generated prompt concept, not the commercial reference recording;
3. do not add raw chart-history fields merely for provenance convenience when they are not required by the product;
4. do not add copied lyrics, reviews, artwork, audio, or other expressive third-party material without a clear right to do so;
5. document any new bulk-data source and its redistribution terms before including substantial source data in the repository;
6. update this document if the research/generation architecture materially changes.

## No endorsement

GRAPH1KS Prompt Control Deck is an independent project. References to artists, songs, labels, chart providers, Suno, or other third parties are descriptive only and do not imply endorsement, partnership, sponsorship, or affiliation.
