// api/pincode-lookup.js
// India pincode → city/state lookup (for display only)

module.exports = async (req, res) => {
  try {
    // GET /api/pincode-lookup?pin=456010
    const pin =
      (req.query && req.query.pin && req.query.pin.toString().trim()) || "";

    if (!pin || pin.length !== 6) {
      return res.status(400).json({
        success: false,
        message: "Valid 6 digit pincode required."
      });
    }

    const url = `https://api.postalpincode.in/pincode/${encodeURIComponent(
      pin
    )}`;

    const resp = await fetch(url);
    const data = await resp.json();

    const entry = Array.isArray(data) ? data[0] : null;
    if (
      !entry ||
      entry.Status !== "Success" ||
      !entry.PostOffice ||
      !entry.PostOffice.length
    ) {
      return res.status(200).json({
        success: false,
        message: "Pincode not found in India Post API."
      });
    }

    const po = entry.PostOffice[0];
    const city = po.District || po.Region || po.Name || "";
    const state = po.State || "";

    return res.status(200).json({
      success: true,
      city,
      state
    });
  } catch (e) {
    console.error("Pincode lookup error", e);
    return res.status(500).json({
      success: false,
      message: "Server error",
      rawError: e.message
    });
  }
};
