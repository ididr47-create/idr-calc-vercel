// netlify/functions/pincode-lookup.js
// India pincode → city/state lookup (for display only)

exports.handler = async (event) => {
  try {
    const pin = (event.queryStringParameters && event.queryStringParameters.pin) || "";

    if (!pin || pin.length !== 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          message: "Valid 6 digit pincode required."
        })
      };
    }

    // Free India postal API
    const url = `https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`;
    const resp = await fetch(url);
    const data = await resp.json();

    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry || entry.Status !== "Success" || !entry.PostOffice || !entry.PostOffice.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          message: "Pincode not found in India Post API."
        })
      };
    }

    const po = entry.PostOffice[0];
    const city = po.District || po.Region || po.Name || "";
    const state = po.State || "";

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        city,
        state
      })
    };
  } catch (e) {
    console.error("Pincode lookup error", e);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: "Server error",
        rawError: e.message
      })
    };
  }
};
