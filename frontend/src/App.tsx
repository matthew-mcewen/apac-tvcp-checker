import { useEffect, useRef, useState } from "react";
import "./App.css";
import { ResultToast } from "./components/ResultToast";

const MIN_CID = 800001;
const MAX_CID = 9999999;
const CHECK_COOLDOWN_SECONDS = 180;
const TOOLTIP_DURATION_MS = 10_000;

export interface CheckResult {
  member: {
    id: number;
    rating: string;
    region: string | null;
    division: string | null;
    subdivision: string | null;
    lastRatingChange: string | null;
  };
  eligible: boolean;
  findings: string[];
}

type SubmitState = "idle" | "submitting" | "success" | "error";

function isValidCid(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const cid = Number(value);
  return cid >= MIN_CID && cid <= MAX_CID;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function regionPath(member: CheckResult["member"]): string {
  return [member.region, member.division, member.subdivision].filter(Boolean).join(" / ") || "—";
}

export default function App() {
  const [cidInput, setCidInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const cooldownIntervalRef = useRef<number | null>(null);
  const tooltipTimeoutRef = useRef<number | null>(null);

  const cidValid = isValidCid(cidInput);

  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) window.clearInterval(cooldownIntervalRef.current);
      if (tooltipTimeoutRef.current) window.clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(CHECK_COOLDOWN_SECONDS);
    if (cooldownIntervalRef.current) window.clearInterval(cooldownIntervalRef.current);
    cooldownIntervalRef.current = window.setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) window.clearInterval(cooldownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function showCooldownTooltip() {
    setTooltipVisible(true);
    if (tooltipTimeoutRef.current) window.clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = window.setTimeout(() => setTooltipVisible(false), TOOLTIP_DURATION_MS);
  }

  function handleCheckClick() {
    if (checking || cooldown > 0 || !cidValid) {
      if (cooldown > 0) showCooldownTooltip();
      return;
    }
    handleCheck();
  }

  async function handleCheck() {
    if (!cidValid) return;
    startCooldown();
    setChecking(true);
    setCheckError(null);
    setResult(null);
    setConsent(false);
    setSubmitState("idle");
    try {
      const response = await fetch(`/api/check?cid=${cidInput}`);
      const data = await response.json();
      if (!response.ok) {
        setCheckError(data.error ?? "Something went wrong checking that CID.");
        return;
      }
      setResult(data as CheckResult);
    } catch {
      setCheckError("Unable to reach the server. Please try again.");
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit() {
    if (!result || !consent) return;
    setSubmitState("submitting");
    setSubmitError(null);
    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: result.member.id, consent: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setSubmitState("error");
        setSubmitError(data.error ?? "Something went wrong submitting your application.");
        return;
      }
      setSubmitState("success");
    } catch {
      setSubmitState("error");
      setSubmitError("Unable to reach the server. Please try again.");
    }
  }

  return (
    <div className="page">
      <div className="form-card">
        <h1 className="form-title">Register</h1>
        <h2 className="form-subtitle">VATSIM APAC Specialists of ATC Project</h2>

        <div className="field-row">
          <label className="field" htmlFor="cid">
            <span className="field-label">VATSIM ID</span>
            <input
              id="cid"
              type="text"
              inputMode="numeric"
              placeholder="1234567"
              value={cidInput}
              onChange={(e) => setCidInput(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCheckClick();
              }}
            />
          </label>
          <div className="check-btn-wrap" onMouseEnter={() => cooldown > 0 && showCooldownTooltip()}>
            {tooltipVisible && <div className="tooltip">You can only check every 3min.</div>}
            <button
              type="button"
              className={`btn btn-primary${!cidValid || checking || cooldown > 0 ? " btn-look-disabled" : ""}`}
              onClick={handleCheckClick}
            >
              {checking ? "Checking…" : cooldown > 0 ? `${cooldown}s` : "Check"}
            </button>
          </div>
        </div>
        {checkError && <p className="error-text">{checkError}</p>}

        <label className="field" htmlFor="rating">
          <span className="field-label">Rating</span>
          <input id="rating" type="text" disabled value={result?.member.rating ?? ""} />
        </label>

        <label className="field" htmlFor="region">
          <span className="field-label">Region / Division / Subdivision</span>
          <input id="region" type="text" disabled value={result ? regionPath(result.member) : ""} />
        </label>

        <label className="field" htmlFor="lastRatingChange">
          <span className="field-label">Last Rating Change</span>
          <input
            id="lastRatingChange"
            type="text"
            disabled
            value={result ? formatDate(result.member.lastRatingChange) : ""}
          />
        </label>

        {result && (
          <ResultToast eligible={result.eligible} findings={result.findings} />
        )}

        {result?.eligible && (
          <>
            <label className="consent-row">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                I consent to my name, CID, and the details shown above, being listed on a
                public roster.
              </span>
            </label>

            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!consent || submitState === "submitting" || submitState === "success"}
              onClick={handleSubmit}
            >
              {submitState === "submitting" ? "Submitting…" : submitState === "success" ? "Submitted" : "Submit"}
            </button>

            {submitState === "success" && (
              <p className="success-text">Your application has been submitted.</p>
            )}
            {submitState === "error" && submitError && (
              <p className="error-text">{submitError}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
