// FlatFinder SPA — vanilla JS, hash routing
const $ = (s, r = document) => r.querySelector(s);
const h = (tag, attrs = {}, ...children) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") el.className = v;
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(c));
  }
  return el;
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const PUNE_AREAS = ["Baner", "Hinjewadi", "Viman Nagar", "Kothrud", "Aundh", "Wakad", "Hadapsar", "Kharadi", "Magarpatta", "Pimpri", "Chinchwad", "Shivajinagar", "Koregaon Park"];
const FLAT_TYPES = ["1 Room", "2 Rooms", "Studio", "1BHK", "2BHK", "3BHK", "4BHK+"];
const BUDGETS = [
  { label: "< ₹10k", min: 0, max: 10000 },
  { label: "₹10k–20k", min: 10000, max: 20000 },
  { label: "₹20k–30k", min: 20000, max: 30000 },
  { label: "₹30k+", min: 30000, max: 9e9 },
];
const AMENITIES = ["Parking", "Gym", "Lift", "Security", "Power Backup", "Wi-Fi", "AC", "Furnished", "Balcony"];

// API helper
const api = async (url, opts = {}) => {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};
const toast = (msg, kind) => {
  const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (kind ? " " + kind : "");
  clearTimeout(window.__tt); window.__tt = setTimeout(() => t.className = "toast", 2400);
};

// Auth state
let me = null;
async function loadMe() {
  try { const { user } = await api("/api/me"); me = user; } catch { me = null; }
}

// ─── Navbar ───
function renderNav() {
  const nav = $("#navbar");
  nav.className = "navbar";
  const links = [h("a", { href: "#/", class: location.hash === "#/" || location.hash === "" ? "active" : "" }, "Browse Flats")];
  if (me) {
    if (me.role === "owner" || me.role === "admin") links.push(h("a", { href: "#/post" }, "Post Flat"));
    links.push(h("a", { href: "#/bookings" }, "Bookings"));
    links.push(h("a", { href: "#/chat" }, "Chat"));
    if (me.role === "admin") links.push(h("a", { href: "#/admin", class: "admin" }, "🛡 Admin"));
    links.push(h("span", { class: "who", style: "color:var(--muted);font-size:.85rem;border-left:1px solid var(--border);padding-left:1rem;margin-left:.5rem;" }, me.name));
    links.push(h("button", { class: "btn btn-ghost btn-sm", onclick: async () => { await api("/api/logout", { method: "POST" }); me = null; renderNav(); route(); } }, "Logout"));
  } else {
    links.push(h("a", { href: "#/login", class: "btn btn-primary btn-sm" }, "Login"));
  }
  nav.replaceChildren(h("div", { class: "container nav-inner" },
    h("a", { href: "#/", class: "brand" }, "🏠 Flat", h("span", { class: "dot" }, "Finder")),
    h("div", { class: "nav-links" }, ...links)
  ));
}

// ─── Pages ───
const state = { search: "", type: null, budget: null, area: null };

async function pageHome() {
  const app = $("#app");
  app.replaceChildren(
    h("section", { class: "hero" },
      h("div", { class: "container" },
        h("span", { class: "badge" }, "📍 Pune Exclusive"),
        h("h1", {}, "Find Your Perfect ", h("br"), h("span", { class: "accent" }, "Flat in Pune")),
        h("p", {}, "Browse affordable 1BHK, 2BHK, 3BHK flats and rooms across Baner, Hinjewadi, Viman Nagar and all top Pune localities."),
        h("div", { class: "search-bar" }, h("input", { type: "text", placeholder: "Search by area, locality or flat name…", value: state.search, oninput: (e) => { state.search = e.target.value; loadFlats(); } }))
      )
    ),
    h("section", { class: "container", style: "padding-bottom:3rem;" },
      buildFilters(),
      h("div", { id: "list-head", class: "section-head" }),
      h("div", { id: "list", class: "grid" }, h("div", { class: "empty" }, "Loading…"))
    )
  );
  loadFlats();
}

function buildFilters() {
  const wrap = h("div", {});
  const makeRow = (label, items, key, getVal) => h("div", { class: "filters" },
    h("span", { style: "font-size:.75rem;font-weight:700;color:var(--muted);align-self:center;margin-right:.25rem;text-transform:uppercase;" }, label),
    ...items.map((it, i) => {
      const val = getVal ? getVal(it, i) : it;
      const active = state[key] === val;
      return h("button", {
        class: "chip" + (active ? " active" : ""),
        onclick: () => { state[key] = active ? null : val; loadFlats(); }
      }, typeof it === "string" ? it : it.label);
    })
  );
  wrap.append(makeRow("Type", FLAT_TYPES, "type"));
  wrap.append(makeRow("Budget", BUDGETS, "budget", (_, i) => i));
  wrap.append(makeRow("Area", PUNE_AREAS, "area"));
  return wrap;
}

async function loadFlats() {
  const params = new URLSearchParams();
  if (state.search) params.set("q", state.search);
  if (state.type) params.set("type", state.type);
  if (state.area) params.set("area", state.area);
  if (state.budget !== null) {
    params.set("minPrice", BUDGETS[state.budget].min);
    params.set("maxPrice", BUDGETS[state.budget].max);
  }
  try {
    const { flats } = await api("/api/flats?" + params.toString());
    const head = $("#list-head"), list = $("#list");
    if (!head || !list) return;
    head.replaceChildren(
      h("h2", {}, `${flats.length} ${flats.length === 1 ? "Flat" : "Flats"} Found`),
      (state.type || state.area || state.budget !== null) ? h("button", { class: "clear-link", onclick: () => { state.type = state.area = null; state.budget = null; pageHome(); } }, "Clear all filters") : null
    );
    if (!flats.length) { list.replaceChildren(h("div", { class: "empty" }, h("p", {}, "No flats match your filters"), h("p", { style: "font-size:.8rem;margin-top:.25rem;" }, "Try adjusting your search"))); return; }
    list.replaceChildren(...flats.map(flatCard));
  } catch (e) { toast(e.message, "error"); }
}

function flatCard(f) {
  const img = f.image_url || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop";
  return h("div", { class: "card" },
    h("div", { class: "img" }, h("img", { src: img, alt: f.title, loading: "lazy" }), h("span", { class: "tag" }, f.type)),
    h("div", { class: "body" },
      h("div", { class: "row" },
        h("div", { class: "title" }, f.title),
        h("div", { class: "price" }, "₹" + Number(f.price).toLocaleString("en-IN"))
      ),
      h("div", { class: "meta" }, "📍 " + (f.address || f.area) + ", Pune"),
      h("div", { class: "amenities" }, ...(f.amenities || []).slice(0, 3).map(a => h("span", { class: "amenity" }, a))),
      h("div", { class: "actions" },
        h("span", { class: "who" }, f.owner_name || ""),
        h("div", { style: "display:flex;gap:.35rem;" },
          h("button", { class: "btn btn-primary btn-sm", onclick: () => openBook(f) }, "📅 Book"),
          h("button", { class: "btn btn-accent btn-sm", onclick: () => startChat(f) }, "💬 Chat")
        )
      )
    )
  );
}

function openBook(f) {
  if (!me) { toast("Please log in to book"); location.hash = "#/login"; return; }
  if (me.id === f.owner_id) { toast("This is your own listing"); return; }
  const overlay = h("div", { class: "modal", onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const inEl = h("input", { type: "date" }), outEl = h("input", { type: "date" });
  overlay.append(h("div", { class: "box" },
    h("h3", {}, "Book " + f.title),
    h("p", { style: "color:var(--muted);font-size:.8rem;margin-top:.25rem;" }, "₹" + Number(f.price).toLocaleString("en-IN") + " / month"),
    h("div", { class: "field" }, h("label", {}, "Check-in"), inEl),
    h("div", { class: "field" }, h("label", {}, "Check-out"), outEl),
    h("div", { class: "actions" },
      h("button", { class: "btn btn-outline", onclick: () => overlay.remove() }, "Cancel"),
      h("button", { class: "btn btn-primary", onclick: async () => {
        if (!inEl.value || !outEl.value) return toast("Pick both dates", "error");
        try { await api("/api/bookings", { method: "POST", body: JSON.stringify({ flat_id: f.id, check_in: inEl.value, check_out: outEl.value }) });
          toast("Booking sent!"); overlay.remove(); }
        catch (e) { toast(e.message, "error"); }
      } }, "Confirm")
    )
  ));
  document.body.append(overlay);
}

async function startChat(f) {
  if (!me) { toast("Please log in to chat"); location.hash = "#/login"; return; }
  if (me.id === f.owner_id) { toast("This is your own listing"); return; }
  try {
    const { id } = await api("/api/chat/conversations", { method: "POST", body: JSON.stringify({ flat_id: f.id }) });
    location.hash = "#/chat?id=" + id;
  } catch (e) { toast(e.message, "error"); }
}

// ─── Login ───
function pageLogin() {
  const app = $("#app");
  const eEl = h("input", { type: "email", placeholder: "you@example.com" });
  const pEl = h("input", { type: "password", placeholder: "Password" });
  app.replaceChildren(h("div", { class: "center-card" },
    h("h1", {}, "Welcome back"),
    h("p", { class: "sub" }, "Sign in to your FlatFinder account"),
    h("div", { class: "field" }, h("label", {}, "Email"), eEl),
    h("div", { class: "field" }, h("label", {}, "Password"), pEl),
    h("button", { class: "btn btn-primary", style: "width:100%;margin-top:1rem;justify-content:center;", onclick: async () => {
      try { const { user } = await api("/api/login", { method: "POST", body: JSON.stringify({ email: eEl.value, password: pEl.value }) });
        me = user; renderNav(); toast("Welcome back!"); location.hash = "#/"; }
      catch (e) { toast(e.message, "error"); }
    } }, "Sign In"),
    h("p", { class: "alt" }, "Don't have an account? ", h("a", { href: "#/signup" }, "Create one"))
  ));
}

function pageSignup() {
  const app = $("#app");
  const nEl = h("input", { type: "text", placeholder: "John Doe" });
  const eEl = h("input", { type: "email", placeholder: "you@example.com" });
  const pEl = h("input", { type: "password", placeholder: "Min 6 characters" });
  let role = "tenant";
  const tBtn = h("button", { class: "active", onclick: () => { role = "tenant"; tBtn.classList.add("active"); oBtn.classList.remove("active"); } }, "🏠 Tenant");
  const oBtn = h("button", { onclick: () => { role = "owner"; oBtn.classList.add("active"); tBtn.classList.remove("active"); } }, "🔑 Owner");
  app.replaceChildren(h("div", { class: "center-card" },
    h("h1", {}, "Create Account"),
    h("p", { class: "sub" }, "Join FlatFinder to find or list flats in Pune"),
    h("div", { class: "field" }, h("label", {}, "Full Name"), nEl),
    h("div", { class: "field" }, h("label", {}, "Email"), eEl),
    h("div", { class: "field" }, h("label", {}, "Password"), pEl),
    h("div", { class: "field" }, h("label", {}, "I am a..."), h("div", { class: "role-pick" }, tBtn, oBtn)),
    h("button", { class: "btn btn-primary", style: "width:100%;margin-top:1rem;justify-content:center;", onclick: async () => {
      try { const { user } = await api("/api/signup", { method: "POST", body: JSON.stringify({ name: nEl.value, email: eEl.value, password: pEl.value, role }) });
        me = user; renderNav(); toast("Account created!"); location.hash = "#/"; }
      catch (e) { toast(e.message, "error"); }
    } }, "Create Account"),
    h("p", { class: "alt" }, "Already have an account? ", h("a", { href: "#/login" }, "Sign in"))
  ));
}

// ─── Post Flat ───
function pagePost() {
  if (!me) { location.hash = "#/login"; return; }
  if (me.role !== "owner" && me.role !== "admin") {
    $("#app").replaceChildren(h("div", { class: "container", style: "padding:3rem 1rem;text-align:center;" },
      h("h1", { class: "font-display", style: "font-size:1.5rem;font-weight:700;" }, "Owners only"),
      h("p", { style: "color:var(--muted);margin-top:.5rem;" }, "Sign up as an owner to post a flat."))); return;
  }
  const f = { title: "", type: "", area: "", address: "", price: "", description: "", amenities: [], image_url: "" };
  const inp = (k, props = {}) => { const e = h("input", { value: f[k], oninput: (ev) => f[k] = ev.target.value, ...props }); return e; };
  const sel = (k, opts) => h("select", { onchange: (ev) => f[k] = ev.target.value },
    h("option", { value: "" }, "Select…"), ...opts.map(o => h("option", { value: o }, o)));
  const amenityChips = h("div", { class: "filters" }, ...AMENITIES.map(a => {
    const c = h("button", { type: "button", class: "chip", onclick: () => { f.amenities = f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a]; c.classList.toggle("active"); } }, a);
    return c;
  }));
  $("#app").replaceChildren(h("div", { class: "form" },
    h("h1", {}, "Post a New Flat"),
    h("p", { style: "color:var(--muted);margin-top:.25rem;" }, "Fill in the details to list your property in Pune"),
    h("div", { class: "banner-info" }, "⏳ Your listing will be reviewed by an admin before going live publicly."),
    h("fieldset", { class: "fieldset" }, h("legend", {}, "Basic"),
      h("div", { class: "field" }, h("label", {}, "Title *"), inp("title", { placeholder: "e.g. Spacious 2BHK near IT Park" })),
      h("div", { class: "row-2" },
        h("div", { class: "field" }, h("label", {}, "Type *"), sel("type", FLAT_TYPES)),
        h("div", { class: "field" }, h("label", {}, "Monthly Rent (₹) *"), inp("price", { type: "number", placeholder: "15000" }))
      )
    ),
    h("fieldset", { class: "fieldset" }, h("legend", {}, "Location"),
      h("div", { class: "field" }, h("label", {}, "Area *"), sel("area", PUNE_AREAS)),
      h("div", { class: "field" }, h("label", {}, "Full Address"), inp("address", { placeholder: "Building name, street, landmark" }))
    ),
    h("fieldset", { class: "fieldset" }, h("legend", {}, "Amenities"), amenityChips),
    h("fieldset", { class: "fieldset" }, h("legend", {}, "Details"),
      h("div", { class: "field" }, h("label", {}, "Description"),
        h("textarea", { oninput: (ev) => f.description = ev.target.value, placeholder: "Describe your flat..." })),
      h("div", { class: "field" }, h("label", {}, "Image URL (optional)"), inp("image_url", { type: "url", placeholder: "https://..." }))
    ),
    h("button", { class: "btn btn-primary", style: "width:100%;margin-top:1rem;padding:.85rem;justify-content:center;", onclick: async () => {
      if (!f.title || !f.type || !f.area || !f.price) return toast("Please fill required fields", "error");
      try { await api("/api/flats", { method: "POST", body: JSON.stringify({ ...f, price: Number(f.price) }) });
        toast("Flat posted! Awaiting approval."); location.hash = "#/"; }
      catch (e) { toast(e.message, "error"); }
    } }, "Post Flat")
  ));
}

// ─── Bookings ───
async function pageBookings() {
  if (!me) { location.hash = "#/login"; return; }
  $("#app").replaceChildren(h("div", { class: "container", style: "padding:2rem 1rem;" },
    h("h1", { class: "font-display", style: "font-size:1.5rem;font-weight:700;" }, "My Bookings"),
    h("p", { style: "color:var(--muted);margin-top:.25rem;" }, "All your booking requests as tenant or owner"),
    h("div", { id: "blist", class: "list" }, h("div", { class: "empty" }, "Loading…"))
  ));
  try {
    const { bookings } = await api("/api/bookings");
    const list = $("#blist");
    if (!bookings.length) { list.replaceChildren(h("div", { class: "empty" }, "No bookings yet.")); return; }
    list.replaceChildren(...bookings.map(b => bookingItem(b)));
  } catch (e) { toast(e.message, "error"); }
}
function bookingItem(b) {
  const isTenant = b.tenant_id === me.id;
  const update = async (status) => { try { await api("/api/bookings/" + b.id, { method: "PATCH", body: JSON.stringify({ status }) }); toast("Booking " + status); pageBookings(); } catch (e) { toast(e.message, "error"); } };
  return h("div", { class: "list-item" },
    h("div", { style: "display:flex;justify-content:space-between;gap:.75rem;" },
      h("div", {}, h("h3", { style: "font-weight:600;" }, b.flat_title), h("div", { style: "color:var(--muted);font-size:.75rem;margin-top:.15rem;" }, "📍 " + b.flat_area + ", Pune")),
      h("span", { class: "badge " + b.status }, b.status)
    ),
    h("div", { class: "detail-grid" },
      h("div", {}, h("b", {}, "Check-in"), b.check_in),
      h("div", {}, h("b", {}, "Check-out"), b.check_out),
      h("div", {}, h("b", {}, "Total"), "₹" + Number(b.total_rent).toLocaleString("en-IN")),
      h("div", {}, h("b", {}, isTenant ? "Owner" : "Tenant"), isTenant ? b.owner_name : b.tenant_name)
    ),
    b.status === "pending" ? h("div", { style: "display:flex;gap:.5rem;margin-top:.75rem;" },
      !isTenant ? h("button", { class: "btn btn-primary btn-sm", onclick: () => update("confirmed") }, "Confirm") : null,
      h("button", { class: "btn btn-outline btn-sm", onclick: () => update("cancelled") }, "Cancel")
    ) : null
  );
}

// ─── Chat ───
let ws = null;
async function pageChat() {
  if (!me) { location.hash = "#/login"; return; }
  const params = new URLSearchParams(location.hash.split("?")[1] || "");
  const activeId = params.get("id");
  $("#app").replaceChildren(h("div", { class: "container" },
    h("div", { class: "chat-shell" + (activeId ? " open" : ""), id: "chat-shell" },
      h("div", { class: "chat-list" },
        h("div", { class: "chat-list-head" }, "Messages"),
        h("div", { class: "chat-list-body", id: "convo-list" }, h("div", { class: "empty", style: "padding:1rem;font-size:.85rem;" }, "Loading…"))
      ),
      h("div", { class: "chat-window", id: "chat-window" },
        h("div", { class: "chat-empty" }, "Select a conversation"))
    )
  ));
  const { conversations } = await api("/api/chat/conversations");
  const list = $("#convo-list");
  if (!conversations.length) { list.replaceChildren(h("div", { class: "empty", style: "padding:1rem;font-size:.85rem;" }, "No conversations yet. Click \"Chat\" on a listing.")); return; }
  list.replaceChildren(...conversations.map(c => {
    const other = c.owner_id === me.id ? c.user_name : c.owner_name;
    return h("div", { class: "chat-row" + (c.id === activeId ? " active" : ""), onclick: () => { location.hash = "#/chat?id=" + c.id; } },
      h("div", { class: "avatar" }, (other || "U").slice(0, 2).toUpperCase()),
      h("div", { class: "info" },
        h("div", { class: "name" }, other),
        h("div", { class: "last", style: "font-size:.7rem;color:var(--muted);" }, c.flat_title),
        h("div", { class: "last" }, c.last_message || "No messages yet"))
    );
  }));
  if (activeId) openConvo(activeId, conversations.find(c => c.id === activeId));
}

async function openConvo(id, convo) {
  const win = $("#chat-window"); if (!win) return;
  const other = convo ? (convo.owner_id === me.id ? convo.user_name : convo.owner_name) : "Chat";
  const body = h("div", { class: "chat-body", id: "chat-body" });
  const input = h("input", { type: "text", placeholder: "Type a message…", onkeydown: (e) => { if (e.key === "Enter") send(); } });
  const send = async () => {
    if (!input.value.trim()) return;
    const text = input.value.trim(); input.value = "";
    try { await api("/api/chat/conversations/" + id + "/messages", { method: "POST", body: JSON.stringify({ content: text }) }); }
    catch (e) { toast(e.message, "error"); }
  };
  win.replaceChildren(
    h("div", { class: "chat-head" },
      h("button", { class: "btn btn-ghost btn-sm", style: "display:none;", onclick: () => $("#chat-shell").classList.remove("open") }, "←"),
      h("div", { class: "avatar" }, (other || "U").slice(0, 2).toUpperCase()),
      h("div", {}, h("div", { style: "font-weight:600;font-size:.9rem;" }, other), h("div", { style: "color:var(--muted);font-size:.75rem;" }, convo?.flat_title || ""))
    ),
    body,
    h("div", { class: "chat-input" }, input, h("button", { class: "btn btn-primary", onclick: send }, "Send"))
  );
  const render = (msgs) => {
    body.replaceChildren(...msgs.map(m => {
      const t = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return h("div", { class: "bubble " + (m.sender_id === me.id ? "me" : "them") }, m.content, h("small", {}, t));
    }));
    body.scrollTop = body.scrollHeight;
  };
  const { messages } = await api("/api/chat/conversations/" + id + "/messages");
  render(messages);

  // WebSocket subscribe
  if (ws) try { ws.close(); } catch {}
  const wsUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
  ws = new WebSocket(wsUrl);
  ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe", conversationId: id }));
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.type === "message" && data.conversationId === id) {
        messages.push(data.payload); render(messages);
      }
    } catch {}
  };
}

// ─── Admin ───
async function pageAdmin() {
  if (!me || me.role !== "admin") { location.hash = "#/"; return; }
  let tab = "listings";
  const render = async () => {
    const { flats } = await api("/api/admin/flats");
    const { users } = await api("/api/admin/users");
    $("#app").replaceChildren(h("div", { class: "container", style: "padding:2rem 1rem;" },
      h("h1", { class: "font-display", style: "font-size:1.5rem;font-weight:700;" }, "🛡 Admin Dashboard"),
      h("div", { class: "tabs" },
        h("button", { class: "tab" + (tab === "listings" ? " active" : ""), onclick: () => { tab = "listings"; render(); } }, "Listings"),
        h("button", { class: "tab" + (tab === "users" ? " active" : ""), onclick: () => { tab = "users"; render(); } }, "Users"),
      ),
      h("div", { class: "list" }, ...(tab === "listings" ? flats.map(adminFlat) : users.map(adminUser)))
    ));
  };
  await render();

  function adminFlat(f) {
    const review = async (status) => { try { await api("/api/flats/" + f.id + "/review", { method: "PATCH", body: JSON.stringify({ status }) }); toast("Listing " + status); render(); } catch (e) { toast(e.message, "error"); } };
    return h("div", { class: "list-item", style: "display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;" },
      h("div", { style: "flex:1;" },
        h("div", {}, h("strong", {}, f.title), " ", h("span", { class: "badge " + f.status }, f.status)),
        h("p", { style: "color:var(--muted);font-size:.75rem;margin-top:.25rem;" }, `${f.type} • ${f.area}, Pune • ₹${Number(f.price).toLocaleString("en-IN")}/mo • Owner: ${f.owner_name}`),
        f.description ? h("p", { style: "color:var(--muted);font-size:.75rem;margin-top:.25rem;" }, f.description) : null
      ),
      f.status === "pending" ? h("div", { style: "display:flex;gap:.4rem;flex-shrink:0;" },
        h("button", { class: "btn btn-primary btn-sm", onclick: () => review("approved") }, "Approve"),
        h("button", { class: "btn btn-outline btn-sm", onclick: () => review("rejected") }, "Reject")
      ) : null
    );
  }
  function adminUser(u) {
    const setStatus = async (status) => { try { await api("/api/admin/users/" + u.id, { method: "PATCH", body: JSON.stringify({ status }) }); toast("User " + status); render(); } catch (e) { toast(e.message, "error"); } };
    return h("div", { class: "list-item", style: "display:flex;justify-content:space-between;gap:.75rem;align-items:center;" },
      h("div", {}, h("strong", {}, u.name), " ", h("span", { class: "badge " + u.status }, u.status), " ", h("span", { class: "amenity" }, u.role),
        h("div", { style: "color:var(--muted);font-size:.75rem;margin-top:.15rem;" }, u.email)),
      u.status === "active"
        ? h("button", { class: "btn btn-outline btn-sm", onclick: () => setStatus("suspended") }, "Suspend")
        : h("button", { class: "btn btn-primary btn-sm", onclick: () => setStatus("active") }, "Activate")
    );
  }
}

// ─── Router ───
function route() {
  const path = (location.hash || "#/").split("?")[0];
  if (path === "#/login") return pageLogin();
  if (path === "#/signup") return pageSignup();
  if (path === "#/post") return pagePost();
  if (path === "#/bookings") return pageBookings();
  if (path === "#/chat") return pageChat();
  if (path === "#/admin") return pageAdmin();
  return pageHome();
}
window.addEventListener("hashchange", () => { renderNav(); route(); });

(async () => { await loadMe(); renderNav(); route(); })();
