# Dependency Review

Use this record for a dependency, service, dataset, SDK, model, asset package, or tool that is non-trivial, redistributed with the product, legally unusual, operationally significant, or difficult to remove.

## Candidate

**Name/version:**  
**Purpose:**  
**Why the existing browser/platform stack is insufficient:**  
**Shipped with the extension:** yes / no

## Cost gate

**Required production cost:**  
**Build/test/distribution cost:**  
**Can normal intended use remain genuinely zero-cost:** yes / no / unclear

A free trial or limited free tier is not automatically zero-cost.

## License / rights gate

**License/terms:**  
**Authoritative source checked:**  
**Commercial compatibility with this project model:** yes / no / unclear  
**Redistribution allowed:** yes / no / unclear  
**Attribution/NOTICE requirements:**  
**Transitive rights concerns:**

## Engineering gate

- [ ] Technical value justifies the dependency.
- [ ] Existing browser/platform APIs cannot solve the problem cleanly enough.
- [ ] Maintenance/security posture is acceptable.
- [ ] Dependency/transitive weight is proportionate.
- [ ] Removal or migration remains reasonable.
- [ ] Privacy/network impact was reviewed.
- [ ] No new extension permission is added without explicit justification.

## Decision

**Decision:** accept / reject / defer  
**Reason:**  
**Follow-up obligations:**
