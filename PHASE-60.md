# TAMPtools Phase 60 — Invoice Generator Dedicated Workspace

## What changed
- Added a dedicated `/apps/invoice-generator.html` application.
- Invoice Generator no longer uses the generic `workspace.html` experience; legacy invoice workspace URLs redirect to the dedicated app.
- Added a dedicated invoicing workflow: Invoice Details → Items & Pricing → Design → Payment & Notes.
- Added live invoice document preview using the same server-side HTML document definition used for PDF export.
- Added five real invoice templates: Classic, Modern, Minimal, Bold, Executive.
- Added template availability by plan, server-enforced.
- Added live line-item calculations for quantity, price, subtotal, discount, tax and total.
- Added business/customer details, dates, reference, currency, payment instructions, notes and optional branding/logo.
- Added saved invoice drafts with create, autosave/update, rename, duplicate, open and delete behavior.
- Added server-side PDF generation using WeasyPrint first, Chromium fallback, with configurable binary paths.
- Added server-side invoice capabilities endpoint and generation limits.
- Added compact TAMP shared shell while preserving the global logo/account/Templates/Support behavior.
- Updated Business sidebar/dashboard routing so Invoice Generator opens the dedicated application and has no redundant child links.

## Research basis
The workflow was informed by current invoicing products including Wave, Zoho Invoice, QuickBooks Online, FreshBooks and Invoice Ninja. Useful patterns adopted include real-time invoice preview, customizable templates, customer/business fields, line-item calculation, saved/duplicated invoices, PDF output, and plan-gated branding/customization.

## Verification performed
- `node --check` passed for changed frontend/backend JavaScript.
- Invoice calculation test passed: subtotal 335,000; discount 33,500; tax 22,612.50; total 324,112.50 NGN.
- Generated PDFs for all five templates.
- Each generated PDF was a valid one-page A4 PDF.
- Extracted PDF text confirmed business name, customer name and calculated total.
- PDF renderer worked with WeasyPrint in the current environment.
- Chromium fallback path remains implemented and configurable.
- Legacy `/workspace.html?tool=invoice-generator` is redirected to the dedicated app.
- Dashboard/sidebar Invoice Generator links point to the dedicated app.

## Not claimed
A live authenticated browser E2E session against the deployed TAMPtools server was not available in this build environment, so account-specific tier switching and browser click-through were verified through implementation/static checks and direct PDF generation rather than falsely claimed as full production E2E testing.
