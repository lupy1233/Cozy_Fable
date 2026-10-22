---
name: bullmq-worker
description: Use this skill when creating or modifying BullMQ queues, workers, delayed jobs, or any scheduled/time-based logic (SLA deadlines, auto-cancel, expirations, reminders, scan mock) in apps/backend.
---

# BullMQ workers — reguli

- Un queue per domeniu (claims, sla, uploads, notifications, billing, requests). Numele jobului = verb.entitate (ex: autocancel.unassigned-claim).
- Handler IDEMPOTENT obligatoriu: la trigger, re-verifica starea curenta din DB inainte de a actiona. Pattern D2: jobul de +1h verifica daca assigned_to e inca NULL; daca nu, iese fara efect. Acelasi pattern la expirari (invite 7 zile, cerere 5 zile, SLA).
- Joburi care modifica claim_slots folosesc acelasi lock pattern ca invarianta 3.1 (SELECT FOR UPDATE pe request).
- Delayed jobs se programeaza la crearea entitatii; la modificarea termenului (ex: SLA pauza/clarificare) se REPROGRAMEAZA (remove + add), nu se adauga unul in plus.
- Ceasuri: 30min/1h/12h/48h = ore calendaristice; SLA oferta si expirare cerere = zile lucratoare prin serviciul de business calendar (Europe/Bucharest). Nu calcula zile lucratoare inline.
- Efectele jobului trec prin services existente (refund, penalizare, notificare) + EventBusService — jobul nu scrie direct in tabele straine si nu emite Socket.IO direct.
- Retry: attempts 3, backoff exponential; joburile esuate raman vizibile in /admin/jobs. Joburile financiare (refund) logheaza in audit.
- Teste: fake timers / time-travel pe logica de termene; un test pe cazul "starea s-a schimbat intre programare si trigger".
