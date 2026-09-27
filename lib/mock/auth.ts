export function issueToken(payload: { sub: string; role: "seller" | "buyer"; name: string; email: string }) {
  return Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 86400000 })).toString("base64");
}

export function verifyToken(authHeader?: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.replace("Bearer ", "");
    const json = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (json.exp && json.exp < Date.now()) return null;
    return json as { sub: string; role: "seller" | "buyer"; name: string; email: string };
  } catch {
    return null;
  }
}
