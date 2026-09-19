# Engineering Decisions

Only record decisions that are expensive to rediscover or materially constrain future work.

## ADR-001 — Public owner-controlled solo development

**Date:** 2026-09-19  
**Status:** accepted

### Context

The repository is public for source visibility, releases, issue reporting, and user inspection, but GRAPH1KS Prompt Control Deck is developed as a solo-owner project rather than a community-governed project.

### Decision

- Repository visibility remains public.
- Development remains owner-controlled.
- Unsolicited external code contributions are not accepted.
- Issues may be used for bug reports, suggestions, compatibility reports, and feedback.
- Discussions are disabled by default.
- Public input does not become roadmap work automatically.
- AI agents act on Issues or other community input only after explicit instruction from Graph1ks.
- No CLA/DCO workflow is active while external contributions are not accepted.

### Why

This preserves public visibility and useful feedback without introducing contribution-rights administration, review overhead, roadmap drift, or ambiguous agent behavior.

### Consequences

If community code contributions are enabled in the future, the contribution-rights, licensing, review, and repository-settings model must be explicitly redesigned first.

---

## ADR-002 — Public noncommercial license with separate commercial rights

**Date:** 2026-09-19  
**Status:** accepted

### Context

The project source is publicly visible while commercial use is controlled separately.

### Decision

- Public project terms remain PolyForm Noncommercial License 1.0.0.
- Commercial use requires a separate written license from Graph1ks.
- Public visibility, forking, or repository access does not grant commercial permission.
- Project licensing grants only rights Graph1ks owns or is entitled to license.

### Consequences

License files, commercial-license documentation, README language, and release material must remain consistent with this model.

---

## ADR-003 — Reference metadata is provenance, not generation input

**Date:** 2026-09-19  
**Status:** accepted

### Context

Factory records may contain real artist/song references used for cataloging and research provenance.

### Decision

reference_artist and reference_song remain provenance/catalog metadata only and must not be consumed by the Suno generation/autofill implementation unless Graph1ks explicitly approves a new design after a rights/licensing review.

### Consequences

The CI regression guard remains required, and docs/DATA_PROVENANCE.md remains authoritative for the detailed policy.
