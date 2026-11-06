/* ==============================================================
   PIXEL DUKA — storefront logic
   ============================================================== */

let ALL_GAMES = [];
let CURRENT_FILTER = "all";
let CURRENT_SORT = "newest";
let CURRENT_SEARCH = "";
let CART = JSON.parse(localStorage.getItem("pd_cart") || "[]");
let ACTIVE_GAME = null;
let ACTIVE_QTY = 1;

document.getElementById("year").textContent = new Date().getFullYear();

/* ----------------------------------------------------------
   SOCIAL ICONS
   ---------------------------------------------------------- */
function renderSocialIcons() {
  const markup = SOCIAL_LINKS.map(s => `
    <a href="${s.url}" target="_blank" rel="noopener" aria-label="${s.name}" title="${s.name}">
      <svg viewBox="0 0 24 24" fill="currentColor">${SOCIAL_ICON_PATHS[s.icon] || ""}</svg>
    </a>`).join("");
  document.getElementById("social-row").innerHTML = markup;
  document.getElementById("mobile-social").innerHTML = markup;
}
renderSocialIcons();

/* ----------------------------------------------------------
   FETCH GAMES FROM SUPABASE
   ---------------------------------------------------------- */
async function loadGames() {
  const grid = document.getElementById("game-grid");
  grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);">Loading catalog…</p>`;

  const { data, error } = await supabaseClient
    .from("games")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;color:var(--danger);">
      Couldn't load the catalog. Check your Supabase URL/anon key in js/supabase-client.js.</p>`;
    console.error(error);
    return;
  }

  ALL_GAMES = data || [];
  updateHeroStats();
  renderGrid();
}

function updateHeroStats() {
  document.getElementById("stat-total").textContent = ALL_GAMES.length;
  document.getElementById("stat-offer").textContent = ALL_GAMES.filter(g => g.is_on_offer).length;
  document.getElementById("stat-free").textContent = ALL_GAMES.filter(g => g.is_free).length;
}

/* ----------------------------------------------------------
   PRICE HELPERS
   ---------------------------------------------------------- */
function effectivePrice(game) {
  if (game.is_free) return 0;
  if (game.is_on_offer && game.discount_percentage > 0) {
    return Math.round(game.price * (1 - game.discount_percentage / 100));
  }
  return game.price;
}
function formatKES(n) {
  return "KES " + Number(n).toLocaleString("en-KE");
}

/* ----------------------------------------------------------
   FILTER + SORT + SEARCH → RENDER GRID
   ---------------------------------------------------------- */
function getVisibleGames() {
  let list = [...ALL_GAMES];

  if (CURRENT_FILTER === "offer") list = list.filter(g => g.is_on_offer);
  if (CURRENT_FILTER === "free") list = list.filter(g => g.is_free);

  if (CURRENT_SEARCH.trim()) {
    const q = CURRENT_SEARCH.trim().toLowerCase();
    list = list.filter(g =>
      g.name.toLowerCase().includes(q) ||
      (g.category || "").toLowerCase().includes(q) ||
      (g.description || "").toLowerCase().includes(q)
    );
  }

  switch (CURRENT_SORT) {
    case "price_asc": list.sort((a, b) => effectivePrice(a) - effectivePrice(b)); break;
    case "price_desc": list.sort((a, b) => effectivePrice(b) - effectivePrice(a)); break;
    case "name_asc": list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "offer_first": list.sort((a, b) => (b.discount_percentage || 0) - (a.discount_percentage || 0)); break;
    default: list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return list;
}

function renderGrid() {
  const list = getVisibleGames();
  const grid = document.getElementById("game-grid");
  document.getElementById("results-count").textContent = `${list.length} game${list.length === 1 ? "" : "s"}`;

  if (!list.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">
      <h3>No games match that search</h3>
      <p>Try a different keyword or clear your filters.</p>
    </div>`;
    return;
  }

  grid.innerHTML = list.map(g => {
    const now = effectivePrice(g);
    const showWas = g.is_on_offer && !g.is_free && g.discount_percentage > 0;
    let tag = "";
    if (g.stock_status === "out_of_stock") tag = `<span class="tag tag-out">Out of stock</span>`;
    else if (g.is_free) tag = `<span class="tag tag-free">Free</span>`;
    else if (g.is_on_offer) tag = `<span class="tag tag-offer">-${g.discount_percentage}%</span>`;

    return `
      <article class="game-card" data-id="${g.id}">
        <img class="thumb" src="${g.image_url || ""}" alt="${g.name}" loading="lazy">
        <div class="card-body">
          <div class="card-category">${g.category || "Game"}</div>
          <div class="card-title">${g.name}</div>
          <div class="card-price-row">
            ${showWas ? `<span class="price-was">${formatKES(g.price)}</span>` : ""}
            <span class="price-now">${g.is_free ? "Free" : formatKES(now)}</span>
            ${tag}
          </div>
        </div>
      </article>`;
  }).join("");

  grid.querySelectorAll(".game-card").forEach(card => {
    card.addEventListener("click", () => openGameModal(card.dataset.id));
  });
}

/* ----------------------------------------------------------
   SEARCH / SORT / FILTER WIRING (desktop + mobile)
   ---------------------------------------------------------- */
function wireSearchSort(inputId, selectId) {
  const input = document.getElementById(inputId);
  const select = document.getElementById(selectId);
  if (input) input.addEventListener("input", e => { CURRENT_SEARCH = e.target.value; renderGrid(); });
  if (select) select.addEventListener("change", e => {
    CURRENT_SORT = e.target.value;
    document.getElementById("sort-select").value = CURRENT_SORT;
    document.getElementById("sort-select-mobile").value = CURRENT_SORT;
    renderGrid();
  });
}
wireSearchSort("search-input", "sort-select");
wireSearchSort("search-input-mobile", "sort-select-mobile");
document.getElementById("search-input").addEventListener("input", e => {
  document.getElementById("search-input-mobile").value = e.target.value;
});
document.getElementById("search-input-mobile").addEventListener("input", e => {
  document.getElementById("search-input").value = e.target.value;
});

document.querySelectorAll("[data-filter]").forEach(el => {
  el.addEventListener("click", e => {
    e.preventDefault();
    CURRENT_FILTER = el.dataset.filter;
    document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c.dataset.filter === CURRENT_FILTER));
    closeMobileNav();
    document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    renderGrid();
  });
});

/* ----------------------------------------------------------
   HAMBURGER / MOBILE NAV
   ---------------------------------------------------------- */
const hamburgerBtn = document.getElementById("hamburger-btn");
const mobileNav = document.getElementById("mobile-nav");
function closeMobileNav() {
  mobileNav.classList.remove("open");
  hamburgerBtn.setAttribute("aria-expanded", "false");
}
hamburgerBtn.addEventListener("click", () => {
  const open = mobileNav.classList.toggle("open");
  hamburgerBtn.setAttribute("aria-expanded", String(open));
});

/* ----------------------------------------------------------
   GAME MODAL
   ---------------------------------------------------------- */
const gameOverlay = document.getElementById("game-overlay");

function openGameModal(id) {
  const g = ALL_GAMES.find(x => x.id === id);
  if (!g) return;
  ACTIVE_GAME = g;
  ACTIVE_QTY = 1;
  document.getElementById("qty-value").textContent = "1";

  document.getElementById("modal-image").src = g.image_url || "";
  document.getElementById("modal-image").alt = g.name;
  document.getElementById("modal-category").textContent = g.category || "Game";
  document.getElementById("modal-title").textContent = g.name;
  document.getElementById("modal-description").textContent = g.description || "";

  const specs = g.specs && typeof g.specs === "object" ? g.specs : {};
  const specEntries = Object.entries(specs);
  document.getElementById("modal-specs").innerHTML = specEntries.length
    ? specEntries.map(([k, v]) => `<div class="spec-item"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")
    : "";

  const now = effectivePrice(g);
  const wasEl = document.getElementById("modal-price-was");
  if (g.is_on_offer && !g.is_free && g.discount_percentage > 0) {
    wasEl.textContent = formatKES(g.price);
    wasEl.hidden = false;
  } else {
    wasEl.hidden = true;
  }
  document.getElementById("modal-price-now").textContent = g.is_free ? "Free" : formatKES(now);

  const addBtn = document.getElementById("modal-add-cart");
  addBtn.disabled = g.stock_status === "out_of_stock";
  addBtn.textContent = g.stock_status === "out_of_stock" ? "Out of Stock" : "Add to Cart";

  gameOverlay.classList.add("open");
}
document.getElementById("modal-close").addEventListener("click", () => gameOverlay.classList.remove("open"));
gameOverlay.addEventListener("click", e => { if (e.target === gameOverlay) gameOverlay.classList.remove("open"); });

document.getElementById("qty-minus").addEventListener("click", () => {
  ACTIVE_QTY = Math.max(1, ACTIVE_QTY - 1);
  document.getElementById("qty-value").textContent = ACTIVE_QTY;
});
document.getElementById("qty-plus").addEventListener("click", () => {
  ACTIVE_QTY = Math.min(10, ACTIVE_QTY + 1);
  document.getElementById("qty-value").textContent = ACTIVE_QTY;
});
document.getElementById("modal-add-cart").addEventListener("click", () => {
  if (!ACTIVE_GAME) return;
  addToCart(ACTIVE_GAME, ACTIVE_QTY);
  gameOverlay.classList.remove("open");
  showToast(`${ACTIVE_GAME.name} added to cart`);
});

/* ----------------------------------------------------------
   CART
   ---------------------------------------------------------- */
function saveCart() { localStorage.setItem("pd_cart", JSON.stringify(CART)); }

function addToCart(game, qty) {
  const existing = CART.find(c => c.id === game.id);
  if (existing) existing.qty = Math.min(10, existing.qty + qty);
  else CART.push({ id: game.id, name: game.name, image_url: game.image_url, qty });
  saveCart();
  renderCart();
}
function removeFromCart(id) {
  CART = CART.filter(c => c.id !== id);
  saveCart();
  renderCart();
}
function cartTotal() {
  return CART.reduce((sum, item) => {
    const g = ALL_GAMES.find(x => x.id === item.id);
    if (!g) return sum;
    return sum + effectivePrice(g) * item.qty;
  }, 0);
}
function renderCart() {
  const box = document.getElementById("cart-items");
  const countBadge = document.getElementById("cart-count");
  const totalQty = CART.reduce((s, c) => s + c.qty, 0);
  countBadge.textContent = totalQty;
  countBadge.hidden = totalQty === 0;

  if (!CART.length) {
    box.innerHTML = `<p style="text-align:center;margin-top:40px;">Your cart is empty.</p>`;
  } else {
    box.innerHTML = CART.map(item => {
      const g = ALL_GAMES.find(x => x.id === item.id);
      const price = g ? effectivePrice(g) : 0;
      return `
        <div class="cart-line">
          <img src="${item.image_url || ""}" alt="${item.name}">
          <div class="info">
            <div class="name">${item.name}</div>
            <div style="color:var(--text-muted);font-size:.85rem;">${item.qty} × ${formatKES(price)}</div>
            <button class="remove" data-id="${item.id}">Remove</button>
          </div>
        </div>`;
    }).join("");
    box.querySelectorAll(".remove").forEach(btn => btn.addEventListener("click", () => removeFromCart(btn.dataset.id)));
  }
  document.getElementById("cart-subtotal").textContent = formatKES(cartTotal());
}
renderCart();

const cartDrawer = document.getElementById("cart-drawer");
const cartOverlay = document.getElementById("cart-overlay");
function openCart() { cartDrawer.classList.add("open"); cartOverlay.classList.add("open"); }
function closeCart() { cartDrawer.classList.remove("open"); cartOverlay.classList.remove("open"); }
document.getElementById("cart-btn").addEventListener("click", openCart);
document.getElementById("cart-close").addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

/* ----------------------------------------------------------
   CHECKOUT — calls the Netlify function, which calls the
   Central Payment API (see netlify/functions/create-payment.js)
   ---------------------------------------------------------- */
document.getElementById("checkout-btn").addEventListener("click", async () => {
  const name = document.getElementById("checkout-name").value.trim();
  const phone = document.getElementById("checkout-phone").value.trim();
  const email = document.getElementById("checkout-email").value.trim();
  const btn = document.getElementById("checkout-btn");

  if (!CART.length) { showToast("Your cart is empty"); return; }
  if (!phone) { showToast("Enter a phone number to continue"); return; }

  btn.disabled = true;
  btn.textContent = "Starting checkout…";

  try {
    const response = await fetch("/.netlify/functions/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_id: "PD-" + Date.now(),
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        items: CART.map(c => ({ game_id: c.id, quantity: c.qty }))
      })
    });
    const result = await response.json();

    if (!response.ok || !result.success) {
      showToast(result.error || "Unable to start payment");
      btn.disabled = false;
      btn.textContent = "Proceed to Checkout";
      return;
    }
    if (result.free_order) {
      showToast(result.message || "Order confirmed — no payment needed");
      CART = []; saveCart(); renderCart();
      btn.disabled = false;
      btn.textContent = "Proceed to Checkout";
      return;
    }
    if (!result.checkout_url) {
      showToast("Payment started but no checkout link was returned. Please contact support.");
      console.error("Missing checkout_url in response:", result);
      btn.disabled = false;
      btn.textContent = "Proceed to Checkout";
      return;
    }
    window.location.href = result.checkout_url;
  } catch (err) {
    console.error(err);
    showToast("Network error — please try again");
    btn.disabled = false;
    btn.textContent = "Proceed to Checkout";
  }
});

/* ----------------------------------------------------------
   ACCOUNT MODAL (Supabase Auth)
   ---------------------------------------------------------- */
const accountOverlay = document.getElementById("account-overlay");
document.getElementById("account-btn").addEventListener("click", async () => {
  accountOverlay.classList.add("open");
  await refreshAccountView();
});
document.getElementById("account-close").addEventListener("click", () => accountOverlay.classList.remove("open"));
accountOverlay.addEventListener("click", e => { if (e.target === accountOverlay) accountOverlay.classList.remove("open"); });

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("login-form").hidden = btn.dataset.tab !== "login";
    document.getElementById("signup-form").hidden = btn.dataset.tab !== "signup";
  });
});

async function refreshAccountView() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const signedIn = !!session;
  document.getElementById("login-form").hidden = signedIn || document.querySelector('.tab-btn[data-tab="signup"]').classList.contains("active");
  document.getElementById("signup-form").hidden = signedIn || document.querySelector('.tab-btn[data-tab="login"]').classList.contains("active");
  document.querySelector(".tabs").hidden = signedIn;
  document.getElementById("account-signed-in").hidden = !signedIn;
  if (signedIn) document.getElementById("account-email").textContent = session.user.email;
}

document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const statusEl = document.getElementById("login-status");
  statusEl.textContent = "Signing in…"; statusEl.className = "auth-status";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { statusEl.textContent = error.message; statusEl.className = "auth-status error"; return; }
  statusEl.textContent = "Signed in!"; statusEl.className = "auth-status success";
  await refreshAccountView();
});

document.getElementById("signup-form").addEventListener("submit", async e => {
  e.preventDefault();
  const name = document.getElementById("signup-name").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const statusEl = document.getElementById("signup-status");
  statusEl.textContent = "Creating account…"; statusEl.className = "auth-status";

  const { error } = await supabaseClient.auth.signUp({
    email, password, options: { data: { full_name: name } }
  });
  if (error) { statusEl.textContent = error.message; statusEl.className = "auth-status error"; return; }
  statusEl.textContent = "Account created — check your email to confirm, then sign in.";
  statusEl.className = "auth-status success";
});

document.getElementById("signout-btn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  await refreshAccountView();
});

/* ----------------------------------------------------------
   TOAST
   ---------------------------------------------------------- */
let toastTimer;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
loadGames();
