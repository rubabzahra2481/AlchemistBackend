import { Injectable } from '@nestjs/common';
import { GUEST_MESSAGE_CAP } from '../config/guest.config';

export interface GuestMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * In-memory store for guest conversations and message counts.
 * Used only for POST /chat/guest; no persistence to Munawar's backend.
 * Data is lost on process restart.
 */
@Injectable()
export class GuestSessionService {
  /** sessionId -> messages (for conversation context) */
  private readonly sessionMessages = new Map<string, GuestMessage[]>();
  /** guestUserId -> total message count (user + assistant) for cap enforcement */
  private readonly guestMessageCount = new Map<string, number>();

  getMessageCount(guestUserId: string): number {
    return this.guestMessageCount.get(guestUserId) ?? 0;
  }

  isOverCap(guestUserId: string): boolean {
    return this.getMessageCount(guestUserId) >= GUEST_MESSAGE_CAP;
  }

  getCap(): number {
    return GUEST_MESSAGE_CAP;
  }

  getHistory(sessionId: string): GuestMessage[] {
    return this.sessionMessages.get(sessionId) ?? [];
  }

  appendMessages(guestUserId: string, sessionId: string, userContent: string, assistantContent: string): void {
    const count = this.getMessageCount(guestUserId);
    this.guestMessageCount.set(guestUserId, count + 2); // user + assistant

    const history = this.sessionMessages.get(sessionId) ?? [];
    history.push({ role: 'user', content: userContent });
    history.push({ role: 'assistant', content: assistantContent });
    this.sessionMessages.set(sessionId, history);
  }
}
