#!/usr/bin/env bash
# Listeaza ID-urile utile pentru capturi (cereri, sloturi de preluare, colectii).
export PGPASSWORD=marketplace
Q() { psql -h localhost -U marketplace -d marketplace -P pager=off "$@"; }
echo "== Cereri (client → /ro/requests/<id>, oferte → /ro/requests/<id>/offers)"
Q -c "select r.id, r.status, r.title, u.email client,
  (select count(*) from quotes q where q.request_id=r.id) oferte
  from requests r join users u on u.id=r.client_user_id order by u.email, r.status"
echo "== Sloturi de preluare (firma → /ro/marketplace/claims/<claim_slot_id>)"
Q -c "select co.name firma, c.id claim_slot_id, c.status slot, r.status cerere, r.title, q.status oferta, q.currency
  from claim_slots c join companies co on co.id=c.company_id join requests r on r.id=c.request_id
  left join quotes q on q.id=c.quote_id order by co.name, r.status"
echo "== Colectii de inspiratie (→ /ro/inspiration/boards/<id>)"
Q -c "select b.id, b.name, u.email, (select count(*) from inspiration_board_items i where i.board_id=b.id) pini
  from inspiration_boards b join users u on u.id=b.user_id order by b.created_at"
