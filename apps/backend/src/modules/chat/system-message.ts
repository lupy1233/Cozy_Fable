import { randomUUID } from 'node:crypto';
import type { MessageSystemKind, Prisma } from '@prisma/client';
import type { MessageCryptoService } from './message-crypto.service';

type Tx = Prisma.TransactionClient;

export interface SystemMessageInput {
  claimSlotId: string;
  // actorul (ex. clientul care cere o modificare / refuza) — mesajul apare ca venind de la el
  senderUserId: string;
  kind: MessageSystemKind;
  // text vizibil (criptat la stocare ca orice mesaj); codul vechi il afiseaza ca mesaj obisnuit
  body: string | null;
  // doar id-uri / coduri (fara date personale) — interfata compune textul din ele
  payload: Record<string, unknown>;
  // revizuire m2: mesajul conteaza ca activitate a clientului (chat_threads.last_client_message_at,
  // citit de CLIENT_UNRESPONSIVE_48H) — ex. cererea de modificare
  clientActivity?: boolean;
}

// a4 (2026-11-13) — mesaj de sistem in conversatia slotului, scris IN tranzactia apelantului,
// intr-un singur round-trip (INSERT ... SELECT pe thread-ul slotului). Fara thread (date vechi)
// → nimic. Nu publica message.created: evenimentul domeniului (quote.updated / quote.declined)
// anunta deja ambele parti, iar un al doilea e-mail ("Mesaj nou") ar dubla anuntul.
// Refolosibil pentru clarificari (e3) cu un `kind` nou.
export async function insertSystemMessage(
  tx: Tx,
  crypto: Pick<MessageCryptoService, 'encrypt'>,
  input: SystemMessageInput,
): Promise<number> {
  const body = crypto.encrypt(input.body);
  if (input.clientActivity) {
    // acelasi round-trip: thread-ul primeste last_client_message_at = momentul mesajului
    return tx.$executeRaw`
      WITH t AS (
        UPDATE chat_threads SET last_client_message_at = now()
        WHERE claim_slot_id = ${input.claimSlotId}
        RETURNING id
      )
      INSERT INTO messages (id, chat_thread_id, sender_user_id, body, system_kind, system_payload, created_at)
      SELECT ${randomUUID()}, t.id, ${input.senderUserId}, ${body},
             ${input.kind}::message_system_kind, ${JSON.stringify(input.payload)}::jsonb, now()
      FROM t`;
  }
  return tx.$executeRaw`
    INSERT INTO messages (id, chat_thread_id, sender_user_id, body, system_kind, system_payload)
    SELECT ${randomUUID()}, ct.id, ${input.senderUserId}, ${body},
           ${input.kind}::message_system_kind, ${JSON.stringify(input.payload)}::jsonb
    FROM chat_threads ct WHERE ct.claim_slot_id = ${input.claimSlotId}`;
}
