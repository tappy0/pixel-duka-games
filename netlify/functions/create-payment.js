// ==============================================================
// PIXEL DUKA — create-payment
// Receives a cart from the storefront, re-prices it from Supabase
// (never trusts the amount sent by the browser), then calls the
// Central Payment API exactly as described in the merchant guide.
// ==============================================================

const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const { order_id, customer_name, customer_phone, customer_email, items } = data;

    if (!customer_phone) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Phone number is required" }) };
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Cart is empty" }) };
    }

    // ----------------------------------------------------------
    // 1. Re-price the cart from Supabase — the source of truth.
    //    We never trust an amount sent by the browser (see the
    //    "Never trust the customer's payment amount" rule).
    // ----------------------------------------------------------
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Server is missing Supabase configuration" }) };
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const ids = items.map((i) => i.game_id);
    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, name, price, is_free, is_on_offer, discount_percentage, stock_status")
      .in("id", ids);

    if (gamesError) {
      console.error(gamesError);
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Could not verify cart against catalog" }) };
    }

    let amount = 0;
    const lineItems = [];

    for (const item of items) {
      const game = games.find((g) => g.id === item.game_id);
      const qty = Math.max(1, Math.min(10, Number(item.quantity) || 1));

      if (!game) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "One of the items in your cart no longer exists" }) };
      }
      if (game.stock_status === "out_of_stock") {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `${game.name} is out of stock` }) };
      }

      let unitPrice = game.is_free ? 0 : Number(game.price);
      if (!game.is_free && game.is_on_offer && game.discount_percentage > 0) {
        unitPrice = Math.round(unitPrice * (1 - game.discount_percentage / 100));
      }

      amount += unitPrice * qty;
      lineItems.push({ product_id: game.id, product_name: game.name, unit_price: unitPrice, quantity: qty });
    }

    // Free carts don't need to hit a payment gateway at all.
    if (amount <= 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          free_order: true,
          checkout_url: null,
          message: "Order confirmed — this cart is free, no payment needed.",
        }),
      };
    }

    // ----------------------------------------------------------
    // 2. Call the Central Payment API with the verified amount.
    // ----------------------------------------------------------
    const CENTRAL_API_URL =
      process.env.CENTRAL_API_URL ||
      "https://lxrdkforhtiudmghydqx.supabase.co/functions/v1/central-create-payment";

    const MERCHANT_API_KEY = process.env.MERCHANT_API_KEY;
    if (!MERCHANT_API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Payment configuration is missing" }) };
    }

    const response = await fetch(CENTRAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MERCHANT_API_KEY,
      },
      body: JSON.stringify({
        order_id: order_id || "PD-" + Date.now(),
        amount,
        currency: "KES",
        customer_phone,
        customer_name: customer_name || "",
        customer_email: customer_email || "",
        description: "Pixel Duka order — " + lineItems.map((l) => `${l.quantity}x ${l.product_name}`).join(", "),
        metadata: { items: lineItems },
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return { statusCode: response.status || 500, headers, body: JSON.stringify({ error: result.error || "Payment request failed" }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        payment_id: result.payment_id,
        order_tracking_id: result.order_tracking_id,
        merchant_reference: result.merchant_reference,
        checkout_url: result.checkout_url,
      }),
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Unable to start payment" }) };
  }
};
