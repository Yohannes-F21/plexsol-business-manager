import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@plexsol/database";
import { apiEnvSchema, type ApiEnv } from "@plexsol/shared";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/lib/password.js";

const suffix = `auth${Date.now()}`;
const staffEmail = `staff-${suffix}@plexsol.com`;
const staffPassword = "Staff-Test-Password-1!";
const adminEmail = "admin@plexsol.com";
const adminPassword =
  process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe-Plexsol-Admin-1!";

function loadTestEnv(overrides: Partial<Record<string, string>> = {}): ApiEnv {
  const parsed = apiEnvSchema.safeParse({
    ...process.env,
    NODE_ENV: "test",
    ...overrides,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid test env: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return parsed.data;
}

describe("auth API", () => {
  const env = loadTestEnv();
  const app = createApp(env);
  let staffUserId = "";
  let adminUserId = "";

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required for auth tests");
    }

    const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!admin) {
      throw new Error("Admin user missing — run pnpm db:seed first");
    }
    adminUserId = admin.id;

    const passwordHash = await hashPassword(staffPassword);
    const staff = await prisma.user.upsert({
      where: { email: staffEmail },
      update: {
        passwordHash,
        role: "STAFF",
        isActive: true,
        name: "Staff Tester",
      },
      create: {
        email: staffEmail,
        name: "Staff Tester",
        role: "STAFF",
        passwordHash,
        isActive: true,
      },
    });
    staffUserId = staff.id;
  }, 60_000);

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: staffUserId } });
    await prisma.user.deleteMany({ where: { email: staffEmail } });
    await prisma.$disconnect();
  });

  it("rejects unauthenticated protected endpoints", async () => {
    const res = await request(app).get("/api/secure/ping");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("rejects invalid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: adminEmail,
      password: "definitely-wrong-password",
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_credentials");
  });

  it("logs in, reads session, and logs out", async () => {
    const agent = request.agent(app);

    const login = await agent.post("/api/auth/login").send({
      email: adminEmail,
      password: adminPassword,
    });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe(adminEmail);
    expect(login.headers["set-cookie"]).toBeTruthy();

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(adminUserId);

    const ping = await agent.get("/api/secure/ping");
    expect(ping.status).toBe(200);

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(204);

    const meAfter = await agent.get("/api/auth/me");
    expect(meAfter.status).toBe(401);
  });

  it("enforces ownership: staff self ok, other user forbidden, admin any ok", async () => {
    const staffAgent = request.agent(app);
    const staffLogin = await staffAgent.post("/api/auth/login").send({
      email: staffEmail,
      password: staffPassword,
    });
    expect(staffLogin.status).toBe(200);

    const own = await staffAgent.get(
      `/api/secure/users/${staffUserId}/profile`,
    );
    expect(own.status).toBe(200);
    expect(own.body.data.userId).toBe(staffUserId);

    const other = await staffAgent.get(
      `/api/secure/users/${adminUserId}/profile`,
    );
    expect(other.status).toBe(403);
    expect(other.body.error).toBe("forbidden");

    const adminAgent = request.agent(app);
    await adminAgent.post("/api/auth/login").send({
      email: adminEmail,
      password: adminPassword,
    });
    const adminView = await adminAgent.get(
      `/api/secure/users/${staffUserId}/profile`,
    );
    expect(adminView.status).toBe(200);
  });

  it("rate limits repeated failed logins", async () => {
    const limitedEnv = loadTestEnv({
      LOGIN_RATE_LIMIT_MAX: "2",
      LOGIN_RATE_LIMIT_WINDOW_MS: "60000",
      SESSION_COOKIE_NAME: `plexsol_session_rl_${suffix}`,
    });
    const limitedApp = createApp(limitedEnv);
    const email = `ratelimit-${suffix}@plexsol.com`;

    const first = await request(limitedApp).post("/api/auth/login").send({
      email,
      password: "wrong-password-1",
    });
    expect(first.status).toBe(401);

    const second = await request(limitedApp).post("/api/auth/login").send({
      email,
      password: "wrong-password-2",
    });
    expect(second.status).toBe(401);

    const third = await request(limitedApp).post("/api/auth/login").send({
      email,
      password: "wrong-password-3",
    });
    expect(third.status).toBe(429);
    expect(third.body.error).toBe("rate_limited");
  });
});
