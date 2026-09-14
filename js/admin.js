/* ==============================================================
   PIXEL DUKA — admin logic
   ============================================================== */

let ADMIN_GAMES = [];
let EDITING_ID = null;

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}
function formatKES(n) { return "KES " + Number(n).toLocaleString("en-KE"); }

/* ----------------------------------------------------------
   AUTH GATE
   ---------------------------------------------------------- */
async function checkAccess() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    document.getElementById("login-gate").hidden = false;
    document.getElementById("admin-dashboard").hidden = true;
    document.getElementById("not-admin-notice").hidden = true;
    document.getElementById("admin-user-box").hidden = true;
    return;
  }

  document.getElementById("admin-user-box").hidden = false;
  document.getElementById("admin-email").textContent = session.user.email;
  document.getElementById("login-gate").hidden = true;

  const { data: adminRow } = await supabaseClient
    .from("admins")
    .select("id")
    .eq("id", session.user.id)
    .maybeSingle();

  if (adminRow) {
    document.getElementById("admin-dashboard").hidden = false;
    document.getElementById("not-admin-notice").hidden = true;
    loadGames();
  } else {
    document.getElementById("admin-dashboard").hidden = true;
    document.getElementById("not-admin-notice").hidden = false;
  }
}

document.getElementById("admin-login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const email = document.getElementById("admin-email-input").value.trim();
  const password = document.getElementById("admin-password-input").value;
  const statusEl = document.getElementById("admin-login-status");
  statusEl.textContent = "Signing in…"; statusEl.className = "auth-status";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) { statusEl.textContent = error.message; statusEl.className = "auth-status error"; return; }
  statusEl.textContent = "";
  checkAccess();
});

document.getElementById("admin-signout").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  checkAccess();
});

/* ----------------------------------------------------------
   SPEC BUILDER (key/value rows → jsonb)
   ---------------------------------------------------------- */
function addSpecRow(key = "", value = "") {
  const wrap = document.createElement("div");
  wrap.className = "spec-pair";
  wrap.innerHTML = `
    <input type="text" placeholder="Key e.g. Platform" class="spec-key" value="${key}">
    <input type="text" placeholder="Value e.g. PC" class="spec-value" value="${value}">
    <button type="button" title="Remove">✕</button>`;
  wrap.querySelector("button").addEventListener("click", () => wrap.remove());
  document.getElementById("spec-builder").appendChild(wrap);
}
document.getElementById("add-spec-row").addEventListener("click", () => addSpecRow());

function collectSpecs() {
  const specs = {};
  document.querySelectorAll("#spec-builder .spec-pair").forEach(row => {
    const k = row.querySelector(".spec-key").value.trim();
    const v = row.querySelector(".spec-value").value.trim();
    if (k) specs[k] = v;
  });
  return specs;
}

/* ----------------------------------------------------------
   OFFER / DISCOUNT TOGGLE
   ---------------------------------------------------------- */
const offerCheckbox = document.getElementById("f-offer");
const discountWrap = document.getElementById("discount-wrap");
function syncDiscountVisibility() { discountWrap.classList.toggle("show", offerCheckbox.checked); }
offerCheckbox.addEventListener("change", syncDiscountVisibility);
syncDiscountVisibility();

/* ----------------------------------------------------------
   FORM RESET / EDIT MODE
   ---------------------------------------------------------- */
function resetForm() {
  EDITING_ID = null;
  document.getElementById("game-form").reset();
  document.getElementById("game-id").value = "";
  document.getElementById("spec-builder").innerHTML = "";
  addSpecRow();
  syncDiscountVisibility();
  document.getElementById("form-title").textContent = "Add a Game";
  document.getElementById("save-game-btn").textContent = "Save Game";
  document.getElementById("cancel-edit-btn").hidden = true;
}
document.getElementById("cancel-edit-btn").addEventListener("click", resetForm);
resetForm();

function startEdit(game) {
  EDITING_ID = game.id;
  document.getElementById("game-id").value = game.id;
  document.getElementById("f-name").value = game.name;
  document.getElementById("f-category").value = game.category || "";
  document.getElementById("f-description").value = game.description || "";
  document.getElementById("f-image").value = game.image_url || "";
  document.getElementById("f-price").value = game.price || 0;
  document.getElementById("f-stock").value = game.stock_status || "available";
  document.getElementById("f-free").checked = !!game.is_free;
  document.getElementById("f-offer").checked = !!game.is_on_offer;
  document.getElementById("f-discount").value = game.discount_percentage || 0;
  syncDiscountVisibility();

  document.getElementById("spec-builder").innerHTML = "";
  const specs = game.specs && typeof game.specs === "object" ? game.specs : {};
  const entries = Object.entries(specs);
  if (entries.length) entries.forEach(([k, v]) => addSpecRow(k, v));
  else addSpecRow();

  document.getElementById("form-title").textContent = `Editing “${game.name}”`;
  document.getElementById("save-game-btn").textContent = "Update Game";
  document.getElementById("cancel-edit-btn").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ----------------------------------------------------------
   SAVE (insert or update)
   ---------------------------------------------------------- */
document.getElementById("game-form").addEventListener("submit", async e => {
  e.preventDefault();
  const statusEl = document.getElementById("game-form-status");
  statusEl.textContent = "Saving…"; statusEl.className = "auth-status";

  const payload = {
    name: document.getElementById("f-name").value.trim(),
    category: document.getElementById("f-category").value.trim(),
    description: document.getElementById("f-description").value.trim(),
    image_url: document.getElementById("f-image").value.trim(),
    price: Number(document.getElementById("f-price").value) || 0,
    stock_status: document.getElementById("f-stock").value,
    is_free: document.getElementById("f-free").checked,
    is_on_offer: document.getElementById("f-offer").checked,
    discount_percentage: document.getElementById("f-offer").checked ? Number(document.getElementById("f-discount").value) || 0 : 0,
    specs: collectSpecs(),
  };

  let error;
  if (EDITING_ID) {
    ({ error } = await supabaseClient.from("games").update(payload).eq("id", EDITING_ID));
  } else {
    ({ error } = await supabaseClient.from("games").insert(payload));
  }

  if (error) {
    statusEl.textContent = error.message; statusEl.className = "auth-status error";
    return;
  }
  statusEl.textContent = EDITING_ID ? "Game updated." : "Game added.";
  statusEl.className = "auth-status success";
  resetForm();
  loadGames();
});

/* ----------------------------------------------------------
   LOAD + RENDER CATALOG TABLE
   ---------------------------------------------------------- */
async function loadGames() {
  const { data, error } = await supabaseClient.from("games").select("*").order("created_at", { ascending: false });
  if (error) { showToast("Couldn't load games: " + error.message); return; }
  ADMIN_GAMES = data || [];
  renderTable();
}

function renderTable() {
  const rows = document.getElementById("admin-game-rows");
  if (!ADMIN_GAMES.length) {
    rows.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:20px;">No games yet — add your first one above.</td></tr>`;
    return;
  }
  rows.innerHTML = ADMIN_GAMES.map(g => {
    let statusLabel = g.stock_status.replace("_", " ");
    if (g.is_free) statusLabel = "free · " + statusLabel;
    else if (g.is_on_offer) statusLabel = `-${g.discount_percentage}% · ` + statusLabel;
    return `
      <tr>
        <td><img src="${g.image_url || ""}" alt=""></td>
        <td>${g.name}</td>
        <td>${g.category || ""}</td>
        <td>${g.is_free ? "Free" : formatKES(g.price)}</td>
        <td>${statusLabel}</td>
        <td>
          <div class="row-actions">
            <button class="edit" data-id="${g.id}">Edit</button>
            <button class="delete" data-id="${g.id}">Delete</button>
          </div>
        </td>
      </tr>`;
  }).join("");

  rows.querySelectorAll(".edit").forEach(btn => btn.addEventListener("click", () => {
    const game = ADMIN_GAMES.find(g => g.id === btn.dataset.id);
    if (game) startEdit(game);
  }));
  rows.querySelectorAll(".delete").forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Delete this game? This cannot be undone.")) return;
    const { error } = await supabaseClient.from("games").delete().eq("id", btn.dataset.id);
    if (error) { showToast("Delete failed: " + error.message); return; }
    showToast("Game deleted");
    loadGames();
  }));
}

/* ----------------------------------------------------------
   INIT
   ---------------------------------------------------------- */
checkAccess();
supabaseClient.auth.onAuthStateChange(() => checkAccess());
