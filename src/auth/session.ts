import type { Player, PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AppConfig } from "../config.js";

export const SESSION_COOKIE_NAME = "onedime_session";

export type CurrentSession = {
  sessionId: string;
  player: Player;
};

export type AuthedRequest = Request & {
  currentSession?: CurrentSession;
};

export class SessionStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: Pick<AppConfig, "sessionSecret" | "sessionTtlDays" | "cookieSecure">
  ) {}

  async createSession(playerId: string, response: Response): Promise<string> {
    const sessionId = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.config.sessionTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.session.create({
      data: {
        id: hashSessionId(sessionId),
        playerId,
        expiresAt
      }
    });

    response.cookie(SESSION_COOKIE_NAME, this.encodeSessionCookie(sessionId), {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: "lax",
      path: "/",
      expires: expiresAt
    });

    return sessionId;
  }

  async getCurrentSession(request: Request): Promise<CurrentSession | null> {
    const sessionId = this.readSessionId(request);
    if (!sessionId) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { id: hashSessionId(sessionId) },
      include: { player: true }
    });

    if (!session) {
      return null;
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.deleteMany({ where: { id: hashSessionId(sessionId) } });
      return null;
    }

    return {
      sessionId,
      player: session.player
    };
  }

  requirePlayer() {
    return async (request: AuthedRequest, response: Response, next: NextFunction) => {
      const currentSession = await this.getCurrentSession(request);
      if (!currentSession) {
        response.redirect("/");
        return;
      }

      request.currentSession = currentSession;
      next();
    };
  }

  async destroySession(request: Request, response: Response): Promise<void> {
    const sessionId = this.readSessionId(request);
    if (sessionId) {
      await this.prisma.session.deleteMany({ where: { id: hashSessionId(sessionId) } });
    }

    response.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: "lax",
      path: "/"
    });
  }

  private readSessionId(request: Request): string | null {
    const value = parseCookies(request.headers.cookie ?? "")[SESSION_COOKIE_NAME];
    if (!value) {
      return null;
    }

    const [sessionId, signature] = value.split(".");
    if (!sessionId || !signature) {
      return null;
    }

    const expected = this.sign(sessionId);
    if (!safeEqual(signature, expected)) {
      return null;
    }

    return sessionId;
  }

  private encodeSessionCookie(sessionId: string): string {
    return `${sessionId}.${this.sign(sessionId)}`;
  }

  private sign(sessionId: string): string {
    return createHmac("sha256", this.config.sessionSecret).update(sessionId).digest("base64url");
  }
}

function parseCookies(header: string): Record<string, string> {
  return header.split(";").reduce<Record<string, string>>((cookies, pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      return cookies;
    }

    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) {
      cookies[key] = decodeURIComponent(value);
    }

    return cookies;
  }, {});
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}
