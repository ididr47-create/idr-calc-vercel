// api/delhivery-rate.js
// Temporary demo rate API so that frontend works end-to-end

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: false,
        message: "Method not allowed"
      })
    );
    return;
  }

  try {
    // Agar body parse nahi bhi hui to bhi hum dummy response de rahe hain,
    // isliye yahan body read nahi kar rahe.
    const baseAmount = 100; // ₹100 as demo base
    const chargedWeightGrams = 1000; // 1 kg demo
    const zone = "Demo";

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: true,
        rate: {
          totalAmount: baseAmount,
          grossAmount: baseAmount,
          chargedWeight: chargedWeightGrams,
          zone
        },
        raw: {
          note: "Demo rate – replace with real Delhivery API later"
        }
      })
    );
  } catch (e) {
    console.error("Delhivery rate error", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: false,
        message: "Server error",
        rawError: e.message
      })
    );
  }
};
