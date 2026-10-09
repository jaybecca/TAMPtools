# Legacy Source Reconciliation

The existing source predates the final TAMPtools product structure and contains several legacy concepts.

## Keep temporarily

The following remain in the source during Phase 1B so the foundation is not destabilized:

- Campaign Studio
- Social publishing adapters
- Social OAuth adapters
- Legacy tool catalog entries
- Existing Starter/Growth pricing records
- Existing campaign/job tables

## Final product direction

The agreed TAMPtools core excludes:

- social account management
- social scheduling
- social publishing
- social analytics

Blog writing, website copy, product descriptions, business content, email writing and career/profile writing remain part of TAMPtools.

## Migration rule

Do not delete legacy modules merely because they are outside the final scope. First migrate UI navigation, catalog, entitlements, API dependencies and data usage in the appropriate implementation phase. Remove unused modules only after dependency checks prove they are no longer required.
