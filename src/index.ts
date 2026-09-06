import { Hono } from "hono";
import config from "../config.json";
import { getMemberDetails, getMemberStats, VatsimNotFoundError } from "./vatsim";
import { evaluateEligibility, type TvcpConfig } from "./eligibility";
import { sendApplicationEmail } from "./delivery/email";
import { sendDiscordNotification } from "./delivery/discord";

interface Env {
  ASSETS: Fetcher;
  VATSIM_API_KEY: string;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  DISCORD_WEBHOOK_URL?: string;
}

const MIN_CID = 800001;
const MAX_CID = 9999999;

function parseCid(raw: string | undefined | null): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const cid = Number(raw);
  if (cid < MIN_CID || cid > MAX_CID) return null;
  return cid;
}

async function lookupAndEvaluate(cid: number, apiKey: string) {
  const [member, stats] = await Promise.all([
    getMemberDetails(cid, apiKey),
    getMemberStats(cid, apiKey),
  ]);
  const result = evaluateEligibility(member, stats, config.tvcp as TvcpConfig);
  return { member, stats, result };
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/check", async (c) => {
  const cid = parseCid(c.req.query("cid"));
  if (cid === null) {
    return c.json({ error: `CID must be an integer between ${MIN_CID} and ${MAX_CID}.` }, 400);
  }

  try {
    const { member, result } = await lookupAndEvaluate(cid, c.env.VATSIM_API_KEY);
    return c.json({
      member: {
        id: member.id,
        rating: result.ratingName,
        region: member.region_id,
        division: member.division_id,
        subdivision: member.subdivision_id,
        lastRatingChange: member.lastratingchange,
      },
      eligible: result.eligible,
      findings: result.findings,
    });
  } catch (error) {
    if (error instanceof VatsimNotFoundError) {
      return c.json({ error: "No VATSIM member found with that CID." }, 404);
    }
    console.error(error);
    return c.json({ error: "Unable to reach the VATSIM API. Please try again shortly." }, 502);
  }
});

app.post("/api/submit", async (c) => {
  const body = await c.req.json<{ cid?: number; consent?: boolean }>().catch(() => null);
  const cid = parseCid(body?.cid?.toString());
  if (cid === null) {
    return c.json({ error: `CID must be an integer between ${MIN_CID} and ${MAX_CID}.` }, 400);
  }
  if (body?.consent !== true) {
    return c.json({ error: "Consent is required to submit an application." }, 400);
  }

  let member;
  let result;
  try {
    ({ member, result } = await lookupAndEvaluate(cid, c.env.VATSIM_API_KEY));
  } catch (error) {
    if (error instanceof VatsimNotFoundError) {
      return c.json({ error: "No VATSIM member found with that CID." }, 404);
    }
    console.error(error);
    return c.json({ error: "Unable to reach the VATSIM API. Please try again shortly." }, 502);
  }

  if (!result.eligible) {
    return c.json({ error: "This CID is no longer eligible.", findings: result.findings }, 409);
  }

  const deliveryErrors: string[] = [];

  if (config.delivery.email.enabled) {
    if (!c.env.SMTP_USERNAME || !c.env.SMTP_PASSWORD) {
      deliveryErrors.push("Email delivery is enabled but SMTP credentials are not configured.");
    } else {
      try {
        await sendApplicationEmail(
          config.delivery.email.smtp,
          { username: c.env.SMTP_USERNAME, password: c.env.SMTP_PASSWORD },
          member,
          result.ratingName,
        );
      } catch (error) {
        console.error(error);
        deliveryErrors.push("Failed to send the application email.");
      }
    }
  }

  if (config.delivery.discord.enabled) {
    if (!c.env.DISCORD_WEBHOOK_URL) {
      deliveryErrors.push("Discord delivery is enabled but the webhook URL is not configured.");
    } else {
      try {
        await sendDiscordNotification(c.env.DISCORD_WEBHOOK_URL, member, result.ratingName);
      } catch (error) {
        console.error(error);
        deliveryErrors.push("Failed to post the Discord notification.");
      }
    }
  }

  if (deliveryErrors.length > 0) {
    return c.json({ error: "Application could not be fully delivered.", findings: deliveryErrors }, 502);
  }

  return c.json({ success: true });
});

export default app;
