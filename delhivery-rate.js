// netlify/functions/delhivery-rate.js
// Delhivery C2C rate proxy – IDR Solutions
// IMPORTANT: Ye server side code hai, isme document/window ka use NHI karna.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    const {
      originPin,
      destPin,
      weightKg,    // actual weight in kg
      mode,        // "Surface" / "Express"
      paymentMode, // "Prepaid" / "COD"
      lengthCm,
      widthCm,
      heightCm
    } = body;

    if (!originPin || !destPin || !weightKg) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "originPin, destPin aur weight required hain."
        })
      };
    }

    const DELHIVERY_TOKEN = process.env.DELHIVERY_TOKEN;
    const DELHIVERY_RATE_URL = process.env.DELHIVERY_RATE_URL;

    if (!DELHIVERY_TOKEN || !DELHIVERY_RATE_URL) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          message: "Delhivery_TOKEN / DELHIVERY_RATE_URL env variables set nahi hain."
        })
      };
    }

    // ----- Chargeable weight (cgm) calculate -----
    const physicalGrams = Math.round(Number(weightKg) * 1000);
    let cgm = physicalGrams;

    if (
      lengthCm && widthCm && heightCm &&
      Number(lengthCm) > 0 && Number(widthCm) > 0 && Number(heightCm) > 0
    ) {
      const volKg = (Number(lengthCm) * Number(widthCm) * Number(heightCm)) / 5000;
      const volGrams = Math.round(volKg * 1000);
      cgm = Math.max(physicalGrams, volGrams);
    }

    // md: E = Express, S = Surface
    const md = mode === "Express" ? "E" : "S";
    const ss = "Delivered";
    const pt = paymentMode === "COD" ? "CoD" : "Pre-paid";

    const url =
      `${DELHIVERY_RATE_URL}` +
      `?md=${encodeURIComponent(md)}` +
      `&ss=${encodeURIComponent(ss)}` +
      `&o_pin=${encodeURIComponent(originPin)}` +
      `&d_pin=${encodeURIComponent(destPin)}` +
      `&cgm=${encodeURIComponent(cgm)}` +
      `&pt=${encodeURIComponent(pt)}`;

    const apiResponse = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${DELHIVERY_TOKEN}`
      }
    });

    const apiData = await apiResponse.json();

    if (!apiResponse.ok) {
      return {
        statusCode: apiResponse.status,
        body: JSON.stringify({
          success: false,
          message: "Delhivery API error",
          rawError: apiData
        })
      };
    }

    // ===== Response se amount nikalna =====
    let first = null;
    if (Array.isArray(apiData) && apiData.length) {
      first = apiData[0];
    } else {
      first = apiData;
    }

    let amount = null;
    if (first && typeof first.total_amount === "number") {
      amount = first.total_amount;          // with GST
    } else if (first && typeof first.gross_amount === "number") {
      amount = first.gross_amount;          // without GST
    }

    const normalizedRate = {
      amount,
      zone: first?.zone || null,
      chargedWeight: first?.charged_weight || cgm,
      grossAmount: first?.gross_amount ?? null,
      totalAmount: first?.total_amount ?? null
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        amount: normalizedRate.amount,
        rate: normalizedRate,
        raw: apiData
      })
    };
  } catch (e) {
    console.error("Function error", e);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Server exception",
        rawError: e.message
      })
    };
  }
};
