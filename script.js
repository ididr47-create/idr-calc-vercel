// Helper
const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove("hidden");
const hide = (el) => el.classList.add("hidden");

// ---------- COD toggle ----------
function setupCodToggle() {
  const codInput = $("codAmount");
  const codError = $("codError");
  const radios = document.querySelectorAll('input[name="paymentMode"]');

  radios.forEach((r) => {
    r.addEventListener("change", () => {
      codError.textContent = "";
      if (r.checked && r.value === "COD") {
        codInput.disabled = false;
      } else {
        codInput.disabled = true;
        codInput.value = "";
      }
    });
  });
}

// ---------- India pincode → city/state lookup (Vercel function) ----------
async function lookupCity(pinType) {
  const pinInput = pinType === "origin" ? $("originPin") : $("destPin");
  const locEl = pinType === "origin" ? $("originLocation") : $("destLocation");
  const errEl = pinType === "origin" ? $("originError") : $("destError");

  if (!pinInput || !locEl || !errEl) return;

  const pin = pinInput.value.trim();
  errEl.textContent = "";
  pinInput.classList.remove("input-error");

  if (pin.length !== 6) {
    locEl.textContent =
      pinType === "origin" ? "Pickup location" : "Delivery location";
    return;
  }

  locEl.textContent = "Checking city…";

  try {
    // Vercel API route
    const resp = await fetch(
      `/api/pincode-lookup?pin=${encodeURIComponent(pin)}`
    );
    const data = await resp.json();

    if (!data.success) {
      locEl.textContent =
        pinType === "origin" ? "Pickup location" : "Delivery location";
      errEl.textContent = "Pincode not found / invalid.";
      pinInput.classList.add("input-error");
      return;
    }

    const cityState = `${data.city}, ${data.state}`.trim();
    locEl.textContent = cityState || "City info not available";
  } catch (e) {
    console.error("City lookup error", e);
    locEl.textContent =
      pinType === "origin" ? "Pickup location" : "Delivery location";
  }
}

function setupPincodeLookup() {
  const originPin = $("originPin");
  const destPin = $("destPin");

  if (originPin) {
    originPin.addEventListener("blur", () => lookupCity("origin"));
    originPin.addEventListener("keyup", () => {
      if (originPin.value.trim().length === 6) lookupCity("origin");
    });
  }

  if (destPin) {
    destPin.addEventListener("blur", () => lookupCity("dest"));
    destPin.addEventListener("keyup", () => {
      if (destPin.value.trim().length === 6) lookupCity("dest");
    });
  }
}

// ---------- backend call ----------
async function callRateAPI(payload) {
  const resp = await fetch("/api/delhivery-rate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await resp.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(text);
  }
  json.httpStatus = resp.status;
  return json;
}

// COD charge formula: max(₹50, 1.65% of COD amount)
function calculateCodCharge(codAmount) {
  if (!codAmount || codAmount <= 0) return 0;
  const perc = codAmount * 0.0165;
  return Math.max(50, perc);
}

// ---------- main handler ----------
async function handleCheckRate() {
  const originPin = $("originPin").value.trim();
  const destPin = $("destPin").value.trim();
  const weightGrams = parseFloat($("weight").value);
  const lengthCm = parseFloat($("length").value || "0");
  const widthCm = parseFloat($("width").value || "0");
  const heightCm = parseFloat($("height").value || "0");
  const mode = $("mode").value || "Surface";
  const paymentRadio = document.querySelector(
    'input[name="paymentMode"]:checked'
  );
  const paymentMode = paymentRadio ? paymentRadio.value : "Prepaid";
  const codAmount = parseFloat($("codAmount").value || "0");

  const resultBox = $("resultBox");
  const resultText = $("resultText");
  const finalPriceBox = $("finalPriceBox");
  const codError = $("codError");

  // reset state
  codError.textContent = "";
  $("originError").textContent = "";
  $("destError").textContent = "";
  $("originPin").classList.remove("input-error");
  $("destPin").classList.remove("input-error");
  hide(finalPriceBox);

  // basic validation
  if (!originPin || originPin.length !== 6) {
    $("originError").textContent = "Valid 6-digit pickup pincode daalein.";
    $("originPin").classList.add("input-error");
    return;
  }
  if (!destPin || destPin.length !== 6) {
    $("destError").textContent = "Valid 6-digit delivery pincode daalein.";
    $("destPin").classList.add("input-error");
    return;
  }
  if (!weightGrams || weightGrams <= 0) {
    resultText.textContent = "Valid package weight (grams) daalein.";
    show(resultBox);
    return;
  }
  if (paymentMode === "COD" && (!codAmount || codAmount <= 0)) {
    codError.textContent = "COD select hai to COD amount (₹) required hai.";
    return;
  }

  const payload = {
    originPin,
    destPin,
    weightKg: weightGrams / 1000,
    mode,
    paymentMode,
    lengthCm,
    widthCm,
    heightCm
  };

  resultText.textContent = "Calculating price…";
  show(resultBox);

  try {
    const data = await callRateAPI(payload);
    console.log("Rate raw:", data.raw);

    if (!data.success) {
      const rawErr = data.rawError || {};
      const msg =
        rawErr.error || rawErr.message || data.message || "Unable to calculate.";
      const lower = msg.toLowerCase();
      const looksLikePin =
        lower.includes("pincode") ||
        lower.includes("pin code") ||
        lower.includes("serviceable") ||
        lower.includes("unable to process");

      if (looksLikePin) {
        $("destError").textContent =
          "Ye destination pincode abhi serviceable nahi lag raha.";
        $("destPin").classList.add("input-error");
        resultText.textContent = "Destination pincode serviceable nahi hai.";
      } else {
        resultText.textContent = msg;
      }
      return;
    }

    const rateInfo = data.rate || {};
    let baseTotal =
      typeof rateInfo.totalAmount === "number"
        ? rateInfo.totalAmount
        : typeof rateInfo.grossAmount === "number"
        ? rateInfo.grossAmount
        : typeof data.amount === "number"
        ? data.amount
        : 0;

    baseTotal = Math.round(baseTotal * 100) / 100;

    let codCharge = 0;
    if (paymentMode === "COD") {
      codCharge = calculateCodCharge(codAmount);
    }

    const beforeMarkup = baseTotal + codCharge;
    const markupPercent = 22;
    const finalPrice =
      Math.round(beforeMarkup * (1 + markupPercent / 100) * 100) / 100;

    // Big bold final price
    finalPriceBox.textContent = `₹${finalPrice.toFixed(2)}`;
    show(finalPriceBox);

    const zone = rateInfo.zone || "-";
    const chargedWeight = rateInfo.chargedWeight || weightGrams;

    resultText.innerHTML = `
      Base charge: ₹${baseTotal.toFixed(2)}
      ${
        paymentMode === "COD"
          ? ` · COD charge: ₹${codCharge.toFixed(2)}`
          : ""
      }
      · Markup: ${markupPercent}%<br/>
      Zone: ${zone} · Charged weight: ${chargedWeight} g · Mode: ${paymentMode}
    `;
  } catch (err) {
    console.error(err);
    resultText.textContent = "Kuch problem aa gayi, thodi der baad try karein.";
  }
}

// ---------- init ----------
document.addEventListener("DOMContentLoaded", () => {
  setupCodToggle();
  setupPincodeLookup();
  $("checkRateBtn").addEventListener("click", handleCheckRate);
});
