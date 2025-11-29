// api/pincode-lookup.js
// India pincode → city/state lookup (for display only)

module.exports = async (req, res) => {
  try {
    // URL se query param nikaalo (pin)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pin = (url.searchParams.get("pin") || "").trim();

    if (!pin || pin.length !== 6) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: false,
          message: "Valid 6 digit pincode required."
        })
      );
      return;
    }

    const apiUrl = `https://api.postalpincode.in/pincode/${encodeURIComponent(
      pin
    )}`;

    const resp = await fetch(apiUrl);
    const data = await resp.json();

    const entry = Array.isArray(data) ? data[0] : null;
    if (
      !entry ||
      entry.Status !== "Success" ||
      !entry.PostOffice ||
      !entry.PostOffice.length
    ) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          success: false,
          message: "Pincode not found in India Post API."
        })
      );
      return;
    }

    const po = entry.PostOffice[0];
    const city = po.District || po.Region || po.Name || "";
    const state = po.State || "";

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        success: true,
        city,
        state
      })
    );
  } catch (e) {
    console.error("Pincode lookup error", e);
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
