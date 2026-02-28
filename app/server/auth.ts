import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import type { RequestHandler } from "express";
import { parse as parseCookie } from "cookie";
import { resolveRepoRoot } from "./utils/paths.js";

const COOKIE_NAME = "x-decafe-token";
const TOKEN_FILE = ".auth-token";

let authToken: string;

/**
 * 起動時にトークンを決定し .auth-token に保存する。
 * 優先順位:
 *   1. AUTH_TOKEN 環境変数（固定トークン、毎回同じ値を使用）
 *   2. 毎回新規生成（起動ごとにローテーション）
 */
export function initAuthToken(): string {
  const tokenPath = path.join(resolveRepoRoot(), TOKEN_FILE);
  const envToken = process.env.AUTH_TOKEN?.trim();

  if (envToken && envToken.length > 0) {
    authToken = envToken;
  } else {
    authToken = randomBytes(32).toString("hex");
  }

  writeFileSync(tokenPath, authToken + "\n", { mode: 0o600 });
  copyTokenToWindows(authToken);
  return authToken;
}

/**
 * WSL環境の場合、Windowsユーザーフォルダに .0x51decafe/.auth-token を作成する。
 * C#アプリから参照しやすくするため。非WSL環境では何もしない。
 */
function copyTokenToWindows(token: string): void {
  try {
    // WSL判定: /proc/version に microsoft or WSL が含まれるか
    const procVersion = readFileSync("/proc/version", "utf-8").toLowerCase();
    if (!procVersion.includes("microsoft") && !procVersion.includes("wsl")) {
      return;
    }

    // Windowsユーザーフォルダを取得
    const winHome = execSync("wslpath \"$(cmd.exe /C 'echo %USERPROFILE%' 2>/dev/null)\"", {
      encoding: "utf-8",
    }).trim().replace(/\r/g, "");

    if (!winHome || !existsSync(winHome)) return;

    const winTokenDir = path.join(winHome, ".0x51decafe");
    mkdirSync(winTokenDir, { recursive: true });
    writeFileSync(path.join(winTokenDir, TOKEN_FILE), token + "\n");
    console.log(`Auth token copied to Windows: ${winTokenDir}/${TOKEN_FILE}`);
  } catch {
    // WSL detection or copy failed — silently skip
  }
}

export function getAuthToken(): string {
  return authToken;
}

/**
 * ページリクエスト時に認証cookieをセットするミドルウェア。
 * Next.js ハンドラの前に挿入する。
 */
export const setTokenCookie: RequestHandler = (_req, res, next) => {
  res.cookie(COOKIE_NAME, authToken, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
  next();
};

/**
 * API / Socket.IO 用の認証ミドルウェア。
 * cookie または Authorization: Bearer ヘッダーでトークンを検証する。
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  // 1. cookie
  const cookieToken = req.cookies?.[COOKIE_NAME];
  if (cookieToken === authToken) {
    next();
    return;
  }

  // 2. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7);
    if (bearerToken === authToken) {
      next();
      return;
    }
  }

  res.status(401).json({ error: "Unauthorized" });
};

/**
 * Socket.IO handshake のcookieからトークンを検証する。
 */
export function verifySocketToken(cookieHeader: string | undefined): boolean {
  if (!cookieHeader) return false;
  const cookies = parseCookie(cookieHeader);
  return cookies[COOKIE_NAME] === authToken;
}
