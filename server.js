
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the website from /public
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "mercado.html")
  );
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "MERCADO",
    payment: "GatePay",
    coingate: false
  });
});

/*
  Create a GatePay hosted checkout link
*/
app.post("/api/payment/gatepay/create", (req, res) => {
  try {
    const {
      orderId,
      amount,
      currency,
      customer
    } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Missing order ID"
      });
    }

    if (!customer?.email) {
      return res.status(400).json({
        success: false,
        error: "Customer email is required"
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid payment amount"
      });
    }

    const gatePayAddress = process.env.GATEPAY_ADDRESS;

    if (!gatePayAddress) {
      return res.status(500).json({
        success: false,
        error: "GATEPAY_ADDRESS is not configured"
      });
    }

    const paymentCurrency = String(
      currency ||
      process.env.GATEPAY_CURRENCY ||
      "GBP"
    ).toUpperCase();

    const provider =
      process.env.GATEPAY_PROVIDER || "hosted";

    /*
      This creates the same type of link shown
      in your GatePay dashboard.
    */
    const params = new URLSearchParams({
      address: gatePayAddress,
      amount: numericAmount.toFixed(2),
      currency: paymentCurrency,
      provider,
      email: customer.email
    });

    const paymentUrl =
      `https://api.gatepay.to/pay.php?${params.toString()}`;

    console.log("GatePay checkout created:", {
      orderId,
      amount: numericAmount.toFixed(2),
      currency: paymentCurrency,
      email: customer.email
    });

    res.json({
      success: true,
      orderId,
      payment
