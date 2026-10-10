interface IPublisher {
  publish(topic: string, data: string): void;
}

export interface IWsClient {
  send(data: unknown): void;
  close(code?: number, reason?: string): void;
}

class WsManager {
  private server: IPublisher | null = null;
  private userSockets = new Map<string, Set<IWsClient>>();
  private sessionSockets = new Map<string, Set<IWsClient>>();

  init(server: IPublisher) {
    this.server = server;
  }

  registerClient(userId: string, ws: IWsClient, sessionId?: string) {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(ws);

    if (sessionId) {
      if (!this.sessionSockets.has(sessionId)) {
        this.sessionSockets.set(sessionId, new Set());
      }
      this.sessionSockets.get(sessionId)!.add(ws);
    }
  }

  unregisterClient(userId: string, ws: IWsClient, sessionId?: string) {
    const userSet = this.userSockets.get(userId);
    if (userSet) {
      userSet.delete(ws);
      if (userSet.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    if (sessionId) {
      const sessionSet = this.sessionSockets.get(sessionId);
      if (sessionSet) {
        sessionSet.delete(ws);
        if (sessionSet.size === 0) {
          this.sessionSockets.delete(sessionId);
        }
      }
    }
  }

  disconnectUser(userId: string) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) {
      return;
    }
    for (const ws of sockets) {
      try {
        ws.send({ event: "session_terminated" });
        ws.close(1008, "Session terminated");
      } catch {
        // ignore errors on already-closed sockets
      }
    }
    this.userSockets.delete(userId);
  }

  disconnectSession(sessionId: string) {
    const sockets = this.sessionSockets.get(sessionId);
    if (!sockets) {
      return;
    }
    for (const ws of sockets) {
      try {
        ws.send({ event: "session_terminated" });
        ws.close(1008, "Session terminated");
      } catch {
        // ignore errors on already-closed sockets
      }
    }
    this.sessionSockets.delete(sessionId);
  }

  publishToUser(userId: string, event: string, payload?: unknown) {
    this.server?.publish(`user:${userId}`, JSON.stringify({ event, payload }));
  }
}

export default new WsManager();
