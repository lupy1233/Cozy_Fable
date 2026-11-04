-- E-client-2: bucket-ul budget_range e DERIVAT din budget_estimate_ron (docs/04).
-- Clientii cu drafturi vechi publicau "Sub 5.000 RON" langa o estimare de 33.000 RON:
-- aici corectam bucket-ul pe toate cererile nesterse care au estimare si nu sunt
-- UNDISCLOSED (pragurile din budgetRangeFromRon: <5000 / <=15000 / restul).
-- size_score (total - ponderea BUDGET veche + ponderea noua) si project_size se
-- recalculeaza DOAR pentru IN_MARKETPLACE / CLAIMED_PARTIAL / EXPIRED (statusuri din
-- care un claim viitor mai poate face snapshot). credit_cost NU se atinge (depinde
-- doar de scorul de baza), iar claim_slots raman neatinse (snapshot-uri inghetate,
-- docs/03 4.5). Migratie doar de date, fara schimbare de schema.
-- Rollback: date derivate; rollback = nu e necesar, valorile vechi erau gresite.
WITH d AS (
  SELECT r.id,
    (CASE WHEN r.budget_estimate_ron < 5000 THEN 'UNDER_5K'
          WHEN r.budget_estimate_ron <= 15000 THEN 'FROM_5K_TO_15K'
          ELSE 'OVER_15K' END)::"budget_range" AS new_range,
    (r.status IN ('IN_MARKETPLACE', 'CLAIMED_PARTIAL', 'EXPIRED') AND r.size_score IS NOT NULL) AS rescore,
    r.size_score - COALESCE((SELECT c.weight FROM project_sizing_config c WHERE c.key = 'BUDGET' AND c.option = r.budget_range::text), 0) AS base_plus
  FROM requests r
  WHERE r.deleted_at IS NULL AND r.budget_estimate_ron IS NOT NULL
    AND r.budget_range IS NOT NULL AND r.budget_range <> 'UNDISCLOSED'
), d2 AS (
  SELECT d.*, d.base_plus + COALESCE((SELECT c.weight FROM project_sizing_config c WHERE c.key = 'BUDGET' AND c.option = d.new_range::text), 0) AS new_score
  FROM d
)
UPDATE requests r SET
  budget_range = d2.new_range,
  size_score = CASE WHEN d2.rescore THEN d2.new_score ELSE r.size_score END,
  project_size = CASE WHEN d2.rescore THEN COALESCE(
      (SELECT t.size FROM project_size_thresholds t WHERE d2.new_score >= t.min_score AND (t.max_score IS NULL OR d2.new_score <= t.max_score) ORDER BY t.min_score LIMIT 1),
      (SELECT t.size FROM project_size_thresholds t ORDER BY t.min_score DESC LIMIT 1))
    ELSE r.project_size END
FROM d2 WHERE r.id = d2.id AND r.budget_range <> d2.new_range;
