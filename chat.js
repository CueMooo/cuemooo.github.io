import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Add the Supabase Project URL and public anon/publishable key here.
const SUPABASE_URL = "PASTE_PROJECT_URL_HERE";
const SUPABASE_KEY = "PASTE_PUBLIC_ANON_OR_PUBLISHABLE_KEY_HERE";
const $ = (id) => document.getElementById(id);
const status = $("chat-status");
const messages = $("chat-messages");
const authSection = $("chat-auth");
const roomSection = $("chat-room");
const authForm = $("chat-auth-form");
const usernameInput = $("chat-auth-username");
const passwordInput = $("chat-auth-password");
const authSubmit = $("chat-auth-submit");
const messageInput = $("chat-message");
const sendButton = $("chat-send");
let db, user = null, username = "", authMode = "signup", lastSent = 0, channel = null;
const seen = new Set();

function say(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}
function normalizeUsername(value) {
  return value.trim().toLowerCase();
}
function validUsername(value) {
  return /^[a-z0-9_]{3,20}$/.test(value);
}
function authEmail(value) {
  // Supabase Auth uses email internally; this reserved, non-deliverable alias
  // gives players username-only sign-in without collecting email addresses.
  return value + "@accounts.cuemoo.invalid";
}
function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
  authSubmit.textContent = mode === "signup" ? "Create account" : "Log in";
  passwordInput.autocomplete = mode === "signup" ? "new-password" : "current-password";
  say(mode === "signup" ? "Choose a username and password." : "Enter your username and password.");
}
function showRoom(profileName) {
  username = profileName;
  $("chat-current-user").textContent = username;
  authSection.classList.add("hidden");
  roomSection.classList.remove("hidden");
  loadMessages();
  subscribeToMessages();
}
function showAuth() {
  user = null;
  username = "";
  roomSection.classList.add("hidden");
  authSection.classList.remove("hidden");
  messages.replaceChildren();
  if (channel) { db.removeChannel(channel); channel = null; }
}
function addMessage(row) {
  if (!row || seen.has(row.id)) return;
  seen.add(row.id);
  messages.querySelector(".chat-empty")?.remove();
  const article = document.createElement("article");
  article.className = "chat-message";
  const top = document.createElement("div");
  top.className = "chat-message-top";
  const author = document.createElement("strong");
  author.className = "chat-message-name";
  author.textContent = row.username || "Player";
  const time = document.createElement("time");
  time.dateTime = row.created_at;
  time.textContent = new Date(row.created_at).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"});
  const body = document.createElement("div");
  body.className = "chat-message-body";
  body.textContent = row.content;
  const report = document.createElement("button");
  report.className = "chat-report";
  report.type = "button";
  report.textContent = "Report";
  report.addEventListener("click", async () => {
    if (!confirm("Report this message to the site owner?")) return;
    const {error} = await db.from("chat_reports").insert({message_id:row.id, reporter_id:user.id});
    say(error ? "Could not submit report." : "Report submitted. Thanks.", !!error);
  });
  top.append(author, time);
  article.append(top, body, report);
  messages.append(article);
  while (messages.children.length > 100) messages.firstElementChild.remove();
  messages.scrollTop = messages.scrollHeight;
}
async function loadMessages() {
  seen.clear();
  messages.innerHTML = '<p class="chat-empty">Loading messages…</p>';
  const {data, error} = await db.from("chat_messages")
    .select("id,username,content,created_at")
    .order("created_at", {ascending:false}).limit(50);
  if (error) { say("Couldn't load chat messages. Check your Supabase setup.", true); return; }
  messages.replaceChildren();
  (data || []).reverse().forEach(addMessage);
  if (!messages.children.length) messages.innerHTML = '<p class="chat-empty">No messages yet. Start the conversation.</p>';
  messageInput.disabled = false;
  sendButton.disabled = false;
  say("Connected. Messages are live.");
}
function subscribeToMessages() {
  if (channel) db.removeChannel(channel);
  channel = db.channel("cuemoo-global-chat")
    .on("postgres_changes", {event:"INSERT", schema:"public", table:"chat_messages"}, event => addMessage(event.new))
    .subscribe(state => {
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") say("Live updates disconnected. Refresh to reconnect.", true);
    });
}
async function handleAuth(event) {
  event.preventDefault();
  if (!db) return;
  const playerName = normalizeUsername(usernameInput.value);
  const password = passwordInput.value;
  if (!validUsername(playerName)) {
    say("Username must be 3–20 characters using letters, numbers, or underscores.", true);
    return;
  }
  if (password.length < 8) {
    say("Password must be at least 8 characters.", true);
    return;
  }
  authSubmit.disabled = true;
  try {
    let result;
    if (authMode === "signup") {
      result = await db.auth.signUp({
        email: authEmail(playerName),
        password,
        options: {data: {username: playerName}}
      });
      if (result.error) throw result.error;
      if (!result.data.session) {
        say("Account created. The site owner must turn OFF email confirmation in Supabase Auth settings before username-only sign-in can work.", true);
        return;
      }
      user = result.data.user;
      username = playerName;
      passwordInput.value = "";
      showRoom(username);
      say("Account created. Welcome!");
    } else {
      result = await db.auth.signInWithPassword({email:authEmail(playerName), password});
      if (result.error) throw result.error;
      user = result.data.user;
      const {data:profile, error:profileError} = await db.from("chat_profiles").select("username").eq("id", user.id).single();
      if (profileError || !profile) throw new Error("Couldn't load your username profile. Ask the site owner to check the SQL setup.");
      passwordInput.value = "";
      showRoom(profile.username);
      say("Logged in. Welcome back!");
    }
  } catch (error) {
    console.error(error);
    say(authMode === "signup" ? (error.message || "Couldn't create account. That username may already be taken.") : "Login failed. Check your username and password.", true);
  } finally {
    authSubmit.disabled = false;
  }
}
async function start() {
  if (SUPABASE_URL.includes("PASTE_") || SUPABASE_KEY.includes("PASTE_")) {
    say("Supabase setup is still needed. Add your Project URL and public key in chat.js.");
    return;
  }
  try {
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
    document.querySelectorAll("[data-auth-mode]").forEach(button =>
      button.addEventListener("click", () => setAuthMode(button.dataset.authMode))
    );
    authForm.addEventListener("submit", handleAuth);
    $("chat-logout").addEventListener("click", async () => {
      const {error} = await db.auth.signOut();
      if (error) { say("Couldn't log out. Try again.", true); return; }
      showAuth();
      say("You are logged out.");
    });
    const {data:{session}, error} = await db.auth.getSession();
    if (error) throw error;
    if (session?.user) {
      user = session.user;
      const {data:profile, error:profileError} = await db.from("chat_profiles").select("username").eq("id", user.id).single();
      if (profileError || !profile) {
        await db.auth.signOut();
        showAuth();
        say("Your chat profile wasn't found. Please create a new account or contact the site owner.", true);
      } else {
        showRoom(profile.username);
      }
    } else {
      setAuthMode("signup");
    }
  } catch (error) {
    console.error(error);
    say("Couldn't connect. Check the Supabase URL, public key, and SQL setup.", true);
  }
}
$("chat-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!user || !username) return;
  const content = messageInput.value.trim();
  if (!content) return;
  if (Date.now() - lastSent < 3000) { say("Wait a moment before sending again.", true); return; }
  lastSent = Date.now();
  sendButton.disabled = true;
  const {error} = await db.from("chat_messages").insert({user_id:user.id, username, content});
  if (error) { say("Message not sent. Please try again.", true); console.error(error); }
  else { messageInput.value = ""; say("Message sent."); }
  sendButton.disabled = false;
});
start();