-- Pasul 7 audit #2 (curatenie L2): chei de setari moarte — blocajul pe angajat a fost
-- descopat prin decizia PO Sprint 7 (doar penalizari company-scope); cheile apareau
-- editabile in Admin → Setari si insalau adminul. 0 consumatori in cod (audit A13/A8).
DELETE FROM "system_settings" WHERE "key" IN ('employee_penalty_threshold', 'employee_block_months');
