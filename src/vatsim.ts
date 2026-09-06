const BASE_URL = "https://api.vatsim.net/v2";

export interface MemberDetails {
  id: number;
  rating: number;
  country: string | null;
  countystate: string | null;
  region_id: string | null;
  division_id: string | null;
  subdivision_id: string | null;
  reg_date: string;
  susp_date: string | null;
  lastratingchange: string | null;
}

export interface MemberStats {
  id: number;
  atc: number;
  pilot: number;
  s1: number;
  s2: number;
  s3: number;
  c1: number;
  c2: number;
  c3: number;
  i1: number;
  i2: number;
  i3: number;
  sup: number;
  adm: number;
}

export class VatsimNotFoundError extends Error {}

async function vatsimGet<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-API-Key": apiKey, Accept: "application/json" },
  });
  if (response.status === 404) {
    throw new VatsimNotFoundError(`VATSIM member not found for ${path}`);
  }
  if (!response.ok) {
    throw new Error(`VATSIM API request to ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function getMemberDetails(cid: number, apiKey: string): Promise<MemberDetails> {
  return vatsimGet<MemberDetails>(`/members/${cid}`, apiKey);
}

export function getMemberStats(cid: number, apiKey: string): Promise<MemberStats> {
  return vatsimGet<MemberStats>(`/members/${cid}/stats`, apiKey);
}
