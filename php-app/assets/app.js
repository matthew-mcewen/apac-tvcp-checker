(function () {
  "use strict";

  const MIN_CID = 800001;
  const MAX_CID = 9999999;
  const CHECK_COOLDOWN_SECONDS = 180;
  const TOOLTIP_DURATION_MS = 10000;

  const cidInput = document.getElementById("cid");
  const checkBtn = document.getElementById("checkBtn");
  const checkBtnWrap = document.getElementById("checkBtnWrap");
  const tooltip = document.getElementById("tooltip");
  const checkError = document.getElementById("checkError");
  const ratingInput = document.getElementById("rating");
  const regionInput = document.getElementById("region");
  const lastRatingChangeInput = document.getElementById("lastRatingChange");
  const resultToast = document.getElementById("resultToast");
  const consentSection = document.getElementById("consentSection");
  const consentCheckbox = document.getElementById("consentCheckbox");
  const submitBtn = document.getElementById("submitBtn");
  const submitSuccess = document.getElementById("submitSuccess");
  const submitError = document.getElementById("submitError");

  let checking = false;
  let result = null;
  let submitting = false;
  let submitted = false;
  let cooldown = 0;
  let cooldownInterval = null;
  let tooltipTimeout = null;

  function isValidCid(value) {
    if (!/^\d+$/.test(value)) return false;
    const cid = Number(value);
    return cid >= MIN_CID && cid <= MAX_CID;
  }

  function formatDate(value) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function regionPath(member) {
    return (
      [member.region, member.division, member.subdivision].filter(Boolean).join(" / ") || "—"
    );
  }

  function updateCheckButton() {
    const cidValid = isValidCid(cidInput.value);
    const disabledLook = !cidValid || checking || cooldown > 0;
    checkBtn.classList.toggle("btn-look-disabled", disabledLook);
    checkBtn.textContent = checking ? "Checking…" : cooldown > 0 ? `${cooldown}s` : "Check";
  }

  function startCooldown() {
    cooldown = CHECK_COOLDOWN_SECONDS;
    if (cooldownInterval) window.clearInterval(cooldownInterval);
    cooldownInterval = window.setInterval(() => {
      cooldown = Math.max(0, cooldown - 1);
      if (cooldown === 0 && cooldownInterval) {
        window.clearInterval(cooldownInterval);
        cooldownInterval = null;
      }
      updateCheckButton();
    }, 1000);
  }

  function showCooldownTooltip() {
    tooltip.hidden = false;
    if (tooltipTimeout) window.clearTimeout(tooltipTimeout);
    tooltipTimeout = window.setTimeout(() => {
      tooltip.hidden = true;
    }, TOOLTIP_DURATION_MS);
  }

  function renderResultToast() {
    if (!result) {
      resultToast.hidden = true;
      resultToast.innerHTML = "";
      return;
    }
    resultToast.hidden = false;
    const eligible = result.eligible;
    const iconClass = eligible ? "bi-emoji-smile" : "bi-emoji-frown";
    const headline = eligible ? "Success!" : "Unable!";
    let body;
    if (eligible) {
      body =
        "<p>You are eligible to be part of the Specialists of ATC program. Click below to submit your application.</p>";
    } else {
      const items = result.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join("");
      body =
        "<p>You aren't currently eligible for the Specialists of ATC program due to the " +
        "following findings. You are welcome to apply again once you are eligible.</p>" +
        `<ol>${items}</ol>`;
    }
    resultToast.innerHTML =
      `<div class="toast-box ${eligible ? "toast-success" : "toast-danger"}">` +
      `<div class="toast-body">` +
      `<div class="toast-header">` +
      `<i class="bi ${iconClass} toast-icon" aria-hidden="true"></i>` +
      `<span class="toast-headline">${headline}</span>` +
      `</div>${body}</div></div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function resetSubmitUi() {
    submitting = false;
    submitted = false;
    submitSuccess.hidden = true;
    submitError.hidden = true;
    consentCheckbox.checked = false;
    updateSubmitButton();
  }

  function updateSubmitButton() {
    submitBtn.disabled = !consentCheckbox.checked || submitting || submitted;
    submitBtn.textContent = submitting ? "Submitting…" : submitted ? "Submitted" : "Submit";
  }

  async function handleCheck() {
    if (!isValidCid(cidInput.value)) return;
    startCooldown();
    checking = true;
    checkError.hidden = true;
    result = null;
    renderResultToast();
    consentSection.hidden = true;
    resetSubmitUi();
    ratingInput.value = "";
    regionInput.value = "";
    lastRatingChangeInput.value = "";
    updateCheckButton();

    try {
      const response = await fetch(`api/check.php?cid=${encodeURIComponent(cidInput.value)}`);
      const data = await response.json();
      if (!response.ok) {
        checkError.textContent = data.error || "Something went wrong checking that CID.";
        checkError.hidden = false;
        return;
      }
      result = data;
      ratingInput.value = result.member.rating || "";
      regionInput.value = regionPath(result.member);
      lastRatingChangeInput.value = formatDate(result.member.lastRatingChange);
      renderResultToast();
      consentSection.hidden = !result.eligible;
    } catch {
      checkError.textContent = "Unable to reach the server. Please try again.";
      checkError.hidden = false;
    } finally {
      checking = false;
      updateCheckButton();
    }
  }

  function handleCheckClick() {
    if (checking || cooldown > 0 || !isValidCid(cidInput.value)) {
      if (cooldown > 0) showCooldownTooltip();
      return;
    }
    handleCheck();
  }

  async function handleSubmit() {
    if (!result || !consentCheckbox.checked) return;
    submitting = true;
    submitError.hidden = true;
    updateSubmitButton();
    try {
      const response = await fetch("api/submit.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid: result.member.id, consent: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        submitting = false;
        submitError.textContent = data.error || "Something went wrong submitting your application.";
        submitError.hidden = false;
        updateSubmitButton();
        return;
      }
      submitting = false;
      submitted = true;
      submitSuccess.hidden = false;
      updateSubmitButton();
    } catch {
      submitting = false;
      submitError.textContent = "Unable to reach the server. Please try again.";
      submitError.hidden = false;
      updateSubmitButton();
    }
  }

  cidInput.addEventListener("input", () => {
    cidInput.value = cidInput.value.replace(/[^\d]/g, "");
    updateCheckButton();
  });
  cidInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleCheckClick();
  });
  checkBtn.addEventListener("click", handleCheckClick);
  checkBtnWrap.addEventListener("mouseenter", () => {
    if (cooldown > 0) showCooldownTooltip();
  });
  consentCheckbox.addEventListener("change", updateSubmitButton);
  submitBtn.addEventListener("click", handleSubmit);

  updateCheckButton();
})();
