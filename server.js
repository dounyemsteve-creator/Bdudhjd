import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mercado.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "mercado-backend",
    status: "online"
  });
});

/* eBay OAuth token */
let ebayTokenCache = {
  token: null,
  expiresAt: 0
};

async function getEbayAccessToken() {
  if (
    ebayTokenCache.token &&
    Date.now() < ebayTokenCache.expiresAt
  ) {
    return ebayTokenCache.token;
  }

  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;

  if (!appId || !certId) {
    throw new Error("Missing EBAY_APP_ID or EBAY_CERT_ID");
  }

  const credentials = Buffer
    .from(`${appId}:${certId}`)
    .toString("base64");

  const response = await fetch(
    "https://api.ebay.com/identity/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body:
        "grant_type=client_credentials&scope=" +
        encodeURIComponent(
          "https://api.ebay.com/oauth/api_scope"
        )
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error("eBay token error:", data);
    throw new Error("eBay authentication failed");
  }

  ebayTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000
  };

  return data.access_token;
}

/* eBay product search */
async function searchEbayProducts(
  query = "popular products",
  limit = 48
) {
  const token = await getEbayAccessToken();

  const url = new URL(
    "https://api.ebay.com/buy/browse/v1/item_summary/search"
  );

  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(Math.min(limit, 200)));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
    }
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("eBay search error:", data);
    throw new Error("eBay product search failed");
  }

  return (data.itemSummaries || []).map((item) => ({
    id: item.itemId,
    itemId: item.itemId,
    name: item.title || "eBay product",
    title: item.title || "eBay product",
    category: "General",
    cat: "General",
    price: Number(item.price?.value || 0),
    rating: 0,
    sold: 0,
    image: item.image?.imageUrl || "",
    imageUrl: item.image?.imageUrl || "",
    thumbnail: item.thumbnailImages?.[0]?.imageUrl || "",
    description: item.shortDescription || "",
    desc: item.shortDescription || "",
    itemUrl: item.itemWebUrl || "",
    url: item.itemWebUrl || "",
    shipping: ""
  }));
}

/* Catalog home */
app.get("/api/catalog/home", async (req, res) => {
  try {
    const items = await searchEbayProducts(
      "electronics fashion home",
      Number(req.query.limit || 48)
    );

    res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error("Catalog home error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
      items: []
    });
  }
});

/* Catalog search */
app.get("/api/catalog/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.json({
        success: true,
        items: []
      });
    }

    const items = await searchEbayProducts(
      query,
      Number(req.query.limit || 48)
    );

    res.json({
      success: true,
      items
    });
  } catch (error) {
    console.error("Catalog search error:", error);

    res.status(500).json({
      success: false,
      error: error.message,
      items: []
    });
  }
});

/* GatePay payment route */
app.post("/api/payment/gatepay/create", (req, res) => {
  try {
    const { orderId, amount, currency, customer } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        error: "Missing orderId or amount"
      });
    }

    const address = process.env.GATEPAY_ADDRESS;

    if (!address) {
      return res.status(500).json({
        success: false,
        error: "GATEPAY_ADDRESS is not configured"
      });
    }

    const params = new URLSearchParams({
      address,
      amount: Number(amount).toFixed(2),
      currency: currency || "GBP",
      provider: process.env.GATEPAY_PROVIDER || "hosted",
      email: customer?.email || "",
      orderId: String(orderId)
    });

    const paymentUrl =
      `https://api.gatepay.to/pay.php?${params.toString()}`;

    res.json({
      success: true,
      paymentUrl,
      payment_url: paymentUrl,
      orderId,
      status: "PENDING"
    });
  } catch (error) {
    console.error("Payment error:", error);

    res.status(500).json({
      success: false,
      error: "Payment creation failed"
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MERCADO server running on port ${PORT}`);
});
