
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 10000;
const PUBLIC_SITE_URL =
  process.env.PUBLIC_SITE_URL || "http://localhost:" + PORT;

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

function createGatePayUrl({ orderId, amount, currency, email }) {
  const address = process.env.GATEPAY_ADDRESS;

  if (!address) {
    throw new Error("GATEPAY_ADDRESS is not configured");
  }

  const params = new URLSearchParams({
    address,
    amount: Number(amount).toFixed(2),
    currency: String(currency || "GBP").toUpperCase(),
    provider: process.env.GATEPAY_PROVIDER || "hosted",
    email: email || "",
    orderId: String(orderId)
  });

  return `https://api.gatepay.to/pay.php?${params.toString()}`;
}

app.post("/api/payment/gatepay/create", (req, res) => {
  try {
    const { orderId, amount, total, currency, customer } = req.body;

    const finalAmount = Number(amount ?? total);
    const email = customer?.email || req.body.email;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Missing orderId"
      });
    }

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment amount"
      });
    }

    const paymentUrl = createGatePayUrl({
      orderId,
      amount: finalAmount,
      currency: currency || process.env.GATEPAY_CURRENCY || "GBP",
      email
    });

    return res.json({
      success: true,
      paymentUrl,
      payment_url: paymentUrl,
      orderId,
      status: "PENDING"
    });
  } catch (error) {
    console.error("GatePay error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Could not create payment"
    });
  }
});

// Compatibility route for older HTML files
app.post("/api/payment/coingate", (req, res) => {
  req.url = "/api/payment/gatepay/create";
  return app._router.handle(req, res);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MERCADO server running on port ${PORT}`);
  console.log(`Public URL: ${PUBLIC_SITE_URL}`);
});
