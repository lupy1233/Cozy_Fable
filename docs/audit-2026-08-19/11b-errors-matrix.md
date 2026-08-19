# Anexa A11b — matricea ERROR_CODES (definit / aruncat BE / mapat i18n FE / documentat)

Generata 2026-08-19 de scriptul de audit shared+prisma; vezi 11-shared-prisma.md.

| Cod | Aruncat BE (occ) | Fisiere BE | i18n FE (namespace-uri apiErrors) | RO=EN | Doc ERROR_CODES.md | Verdict |
|---|---|---|---|---|---|---|
| VALIDATION_ERROR | 17 | ~/filters/all-exceptions.filter.ts<br>~/idempotency/idempotency.interceptor.ts<br>billing/payments.controller.ts (+4) | Auth, Company, Requests, Marketplace, Quotes, Lifecycle | da | da | ok |
| UNAUTHORIZED | 5 | ~/filters/all-exceptions.filter.ts<br>auth/auth.service.ts<br>auth/guards/jwt-auth.guard.ts (+1) | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| FORBIDDEN | 22 | ~/filters/all-exceptions.filter.ts<br>~/guards/company-approved.guard.ts<br>~/guards/subscription-active.guard.ts (+10) | Company, Marketplace, Quotes | da | da | ok |
| NOT_FOUND | 56 | ~/filters/all-exceptions.filter.ts<br>~/guards/company-approved.guard.ts<br>admin/admin.service.ts (+16) | Company, Quotes | da | da | ok |
| RATE_LIMITED | 1 | ~/filters/all-exceptions.filter.ts | Auth | da | da | ok |
| IDEMPOTENCY_CONFLICT | 1 | ~/idempotency/idempotency.interceptor.ts | Marketplace, Quotes | da | da | ok |
| INTERNAL_ERROR | 2 | ~/filters/all-exceptions.filter.ts | Auth, Company, Requests, Marketplace, Quotes, Lifecycle | da | da | ok |
| INVALID_CREDENTIALS | 1 | auth/auth.service.ts | Auth | da | da | ok |
| EMAIL_ALREADY_REGISTERED | 1 | auth/auth.service.ts | Auth | da | da | ok |
| EMAIL_NOT_VERIFIED | 1 | auth/auth.service.ts | Auth | da | da | ok |
| REFRESH_TOKEN_INVALID | 2 | auth/auth.controller.ts<br>auth/token.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| REFRESH_TOKEN_REUSED | 1 | auth/token.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| SESSION_SUPERSEDED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| TWO_FACTOR_REQUIRED | 1 | auth/auth.service.ts | Auth | da | da | ok |
| TWO_FACTOR_INVALID_CODE | 2 | auth/auth.service.ts<br>auth/two-factor.service.ts | Auth | da | da | ok |
| COMPANY_NOT_APPROVED | 1 | ~/guards/company-approved.guard.ts | Marketplace | da | da | ok |
| COMPANY_SUSPENDED | 1 | ~/guards/company-approved.guard.ts | Marketplace | da | da | ok |
| COMPANY_REAPPLY_BLOCKED | 1 | companies/companies.service.ts | Company | da | da | ok |
| CUI_ALREADY_REGISTERED | 1 | companies/companies.service.ts | Company | da | da | ok |
| MEMBER_ALREADY_EXISTS | 2 | companies/companies.service.ts | Company | da | da | ok |
| LAST_OWNER_CANNOT_LEAVE | 2 | companies/companies.service.ts | Company | da | da | ok |
| DRAFT_TOKEN_INVALID | 1 | requests/requests.service.ts | Requests | da | da | ok |
| REQUEST_NOT_EDITABLE | 6 | requests/requests.service.ts | Requests | da | da | ok |
| EDIT_LIMIT_PRE_CLAIM_REACHED | 1 | requests/requests.service.ts | Requests | da | da | ok |
| EDIT_LIMIT_POST_CLAIM_REACHED | 1 | requests/requests.service.ts | Requests | da | da | ok |
| EDIT_BLOCKED_OFFER_RECEIVED | 1 | requests/requests.service.ts | Requests | da | da | ok |
| REQUEST_EXPIRED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| REPOST_ALREADY_USED | 1 | requests/requests.service.ts | Requests | da | da | ok |
| GEOCODING_FAILED | 1 | geo/geo.service.ts | Requests, Configurator | da | da | ok |
| CONFIGURATOR_ANSWERS_INVALID | 1 | requests/configurator.service.ts | Configurator | da | NU | ok; nedocumentat |
| CONFIGURATOR_FLOW_VERSION_UNSUPPORTED | 1 | requests/configurator.service.ts | Configurator | da | NU | ok; nedocumentat |
| CONFIGURATOR_STATE_TOO_LARGE | 1 | requests/requests.service.ts | Configurator | da | NU | ok; nedocumentat |
| CLAIM_NOT_ALLOWED | 4 | claims/claims.service.ts<br>claims/clarifications.service.ts | Marketplace, Lifecycle | da | da | ok |
| CLAIM_SLOTS_FULL | 1 | claims/claims.service.ts | Marketplace | da | da | ok |
| INSUFFICIENT_CREDITS | 1 | billing/credits.service.ts | Marketplace (+ text dedicat marketplace/[id]) | da | da | ok |
| SUBSCRIPTION_INACTIVE | 1 | ~/guards/subscription-active.guard.ts | Marketplace | da | da | ok |
| OUT_OF_COVERAGE_AREA | 1 | claims/claims.service.ts | Marketplace | da | da | ok |
| GATING_NOT_OPEN | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| COMPANY_EXCLUDED_FROM_REQUEST | 1 | claims/claims.service.ts | Marketplace | da | da | ok |
| ACTIVE_CLAIM_WITHOUT_OFFER_EXISTS | 2 | claims/claims.service.ts | Marketplace | da | da | ok |
| MANAGER_UNASSIGNED_CAP_REACHED | 1 | claims/claims.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| ASSIGNED_USER_HAS_ACTIVE_CLAIM | 3 | claims/claims.service.ts | Marketplace | da | da | ok |
| ASSIGNED_USER_PENALTY_BLOCKED | 0 |  | Marketplace | da | da | MORT (definit, niciodata aruncat) |
| CLAIM_ALREADY_EXISTS | 2 | claims/claims.service.ts | Marketplace | da | da | ok |
| WITHDRAWAL_REASON_NOT_VALIDATED | 2 | claims/withdrawals.service.ts | Lifecycle | da | da | ok |
| WITHDRAWAL_ALREADY_PENDING | 1 | claims/withdrawals.service.ts | Lifecycle | da | da | ok |
| WITHDRAWAL_GRACE_EXPIRED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| WITHDRAWAL_ALREADY_DECIDED | 1 | claims/withdrawals.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| CLAIM_NOT_WITHDRAWABLE | 1 | claims/withdrawals.service.ts | Lifecycle | da | NU | ok; nedocumentat |
| REQUEST_NOT_DELETABLE | 1 | requests/requests.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| QUOTE_VERSION_LIMIT_REACHED | 3 | quotes/quotes.service.ts | Quotes | da | da | ok |
| QUOTE_ALREADY_SENT | 1 | quotes/quotes.service.ts | Quotes | da | NU | ok; nedocumentat |
| CHANGE_REQUEST_ALREADY_REJECTED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| CHANGE_REQUEST_NOT_PENDING | 2 | quotes/quotes.service.ts | Quotes | da | NU | ok; nedocumentat |
| QUOTE_EXPIRED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| QUOTE_WITHDRAW_WINDOW_CLOSED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| VALIDITY_EXTENSION_LIMIT_REACHED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| OFFER_FIELD_NOT_EDITABLE | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| CONSULTATION_INVITE_EXPIRED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| NEGOTIATION_ENDED | 1 | quotes/quotes.service.ts | Quotes | da | da | ok |
| QUOTE_ACCEPT_NOT_ALLOWED | 4 | quotes/quotes.service.ts | Quotes | da | da | ok |
| THREAD_READ_ONLY | 2 | chat/chat.service.ts | Quotes | da | da | ok |
| FILE_TOO_LARGE | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| FILE_LIMIT_REACHED | 2 | chat/chat.service.ts<br>uploads/uploads.service.ts | Requests | da | da | ok |
| FILE_TYPE_NOT_ALLOWED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| FILE_SCAN_BLOCKED | 2 | requests/requests.service.ts<br>uploads/uploads.service.ts | Configurator | da | da | ok |
| UPLOAD_NOT_FOUND_IN_STORAGE | 1 | uploads/uploads.service.ts | Requests | da | da | ok |
| CLARIFICATION_ALREADY_PENDING | 1 | claims/clarifications.service.ts | Lifecycle | da | da | ok |
| SLA_ALREADY_BREACHED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| PAYMENT_SIGNATURE_INVALID | 1 | billing/payments.controller.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| PAYMENT_ALREADY_CONFIRMED | 1 | billing/payments.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| PAYMENT_NOT_FOUND | 2 | billing/invoice-pdf.service.ts<br>billing/payments.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| CREDIT_PACKAGE_INACTIVE | 1 | billing/payments.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| CREDITS_EXPIRED | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| DELIVERY_NOT_ALLOWED | 2 | fulfillment/fulfillment.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| COMPLETION_NOT_ALLOWED | 1 | fulfillment/fulfillment.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| REVIEW_NOT_ALLOWED_YET | 2 | fulfillment/fulfillment.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| REVIEW_ALREADY_SUBMITTED | 1 | fulfillment/fulfillment.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| DISPUTE_ALREADY_DECIDED | 1 | fulfillment/fulfillment.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| SETTING_KEY_UNKNOWN | 1 | admin/admin.service.ts | - | da | da | aruncat, FARA mesaj FE → fallback generic |
| AUDIT_LOG_IMMUTABLE | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| ADMIN_DECISION_REQUIRED_FIELDS | 0 |  | - | da | da | MORT (definit, niciodata aruncat) |
| BOARD_NAME_TAKEN | 1 | inspiration/boards.service.ts | - (cod tratat direct (boards/page, board-picker)) | da | NU | ok; nedocumentat |
| STUDIO_DRAFT_NAME_TAKEN | 1 | studio/studio.service.ts | - (cod tratat direct (studio-page toast)) | da | NU | ok; nedocumentat |
| STUDIO_DRAFT_LIMIT_REACHED | 1 | studio/studio.service.ts | - (cod tratat direct (studio-page toast)) | da | NU | ok; nedocumentat |
| STUDIO_DRAFT_INVALID | 1 | studio/studio.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
| STUDIO_DRAFT_TOO_LARGE | 1 | studio/studio.service.ts | - | da | NU | aruncat, FARA mesaj FE → fallback generic; nedocumentat |
