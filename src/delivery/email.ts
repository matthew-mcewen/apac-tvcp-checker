import { WorkerMailer } from "worker-mailer";
import type { MemberDetails } from "../vatsim";
import type { RatingName } from "../eligibility";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  startTls: boolean;
  fromName: string;
  fromAddress: string;
  toAddress: string;
}

export async function sendApplicationEmail(
  smtp: SmtpConfig,
  credentials: { username: string; password: string },
  member: MemberDetails,
  ratingName: RatingName,
): Promise<void> {
  await WorkerMailer.send(
    {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      startTls: smtp.startTls,
      credentials,
      authType: "plain",
    },
    {
      from: { name: smtp.fromName, email: smtp.fromAddress },
      to: { email: smtp.toAddress },
      subject: `TVCP Application — CID ${member.id}`,
      text:
        `A new TVCP application has been submitted.\n\n` +
        `CID: ${member.id}\n` +
        `Rating: ${ratingName}\n` +
        `Region/Division/Subdivision: ${[member.region_id, member.division_id, member.subdivision_id].filter(Boolean).join(" / ")}\n` +
        `Last rating change: ${member.lastratingchange ?? "unknown"}\n`,
    },
  );
}
