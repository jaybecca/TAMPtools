# Phase 55 — TAMPtools Architecture Reset

## Root cause
Historically, most tools were routed through `frontend/workspace.html` and rendered by `frontend/workspace.js`. Tool-specific render functions existed, but they were mounted inside one generic workspace DOM/CSS shell. This made different tools visually and behaviorally converge.

## New rule
TAMP has a shared product shell, not a shared tool application.

### Shared
- authentication/session
- TAMPtools brand/logo
- account/avatar menu
- Dashboard / Templates / Support navigation
- billing/entitlements
- common API/auth helpers

### Tool-owned
- entry HTML
- application JavaScript
- tool-specific CSS/state model
- workspace/canvas/editor
- tool-specific interactions
- tool-specific output pipeline

## Migration registry
`frontend/apps/tool-registry.js` records migration status. A tool is `migrated` only when it has its own entry point and no longer depends on the generic workspace renderer for its primary UI.

Phase 55 migrates **Document & PDF Studio** first:
- `/apps/document-pdf.html`
- `/apps/document-pdf.js`

The old `/workspace.html?tool=document-pdf-studio` route is no longer used by Dashboard/homepage/Templates links.

## Legacy boundary
`frontend/workspace.html` and `frontend/workspace.js` are retained temporarily so existing tools continue functioning during migration. They are explicitly legacy architecture and must not receive new tool implementations.

## Verification contract
A migrated tool must be verified through its real entry route and operation flow. Syntax/ZIP checks are insufficient.
