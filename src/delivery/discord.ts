import type { MemberDetails } from "../vatsim";
import type { RatingName } from "../eligibility";

export async function sendDiscordNotification(
  webhookUrl: string,
  member: MemberDetails,
  ratingName: RatingName,
): Promise<void> {
  const regionPath = [member.region_id, member.division_id, member.subdivision_id]
    .filter(Boolean)
    .join(" / ");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "New TVCP Application",
          color: 0x0d6efd,
          fields: [
            { name: "CID", value: String(member.id), inline: true },
            { name: "Rating", value: ratingName, inline: true },
            { name: "Region / Division / Subdivision", value: regionPath || "unknown", inline: false },
            { name: "Last rating change", value: member.lastratingchange ?? "unknown", inline: false },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
  }
}
