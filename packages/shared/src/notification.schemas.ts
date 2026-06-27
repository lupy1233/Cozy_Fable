// Sprint 9 — notificari in-app (docs/06 §7.3). type = nume eveniment de domeniu (3.5).

export interface NotificationDto {
  id: string;
  type: string;
  title: string | null;
  payload: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface UnreadCountDto {
  unread: number;
}
