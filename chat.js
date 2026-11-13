import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Paste your Supabase Project URL and public anon/publishable key below.
const SUPABASE_URL = "PASTE_PROJECT_URL_HERE";
const SUPABASE_KEY = "PASTE_PUBLIC_ANON_OR_PUBLISHABLE_KEY_HERE";
const $ = (id) => document.getElementById(id);
const status = $("chat-status"), messages = $("chat-messages");
const nameInput = $("chat-username"), messageInput = $("chat-message");
const send = $("chat-send");
let db, user, lastSent = 0;
const seen = new Set();

function say(text, error = false) {
  status.textContent = text;
  status.classList.toggle("error", error);
}
function name() { return (localStorage.getItem("cuemoo-chat-name") || "").trim(); }
function saveName() {
  const value = nameInput.value.trim().replace(/\s+/g, " ").slice(0, 20);
  if (value.length < 2) { say("Use a display name with at least 2 characters.", true); return false; }
  localStorage.setItem("cuemoo-chat-name", value);
  nameInput.value = value;
  say("Display name saved.");
  return true;
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
async function start() {
  if (SUPABASE_URL.includes("PASTE_") || SUPABASE_KEY.includes("PASTE_")) {
    say("Create your free Supabase project, then add its Project URL and public key in chat.js.");
    return;
  }
  try {
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
    const {data:auth, error:authError} = await db.auth.signInAnonymously();
    if (authError) throw authError;
    user = auth.user;
    const {data, error} = await db.from("chat_messages").select("id,username,content,created_at").order("created_at",{ascending:false}).limit(50);
    if (error) throw error;
    messages.innerHTML = "";
    (data || []).reverse().forEach(addMessage);
    if (!messages.children.length) messages.innerHTML = '<p class="chat-empty">No messages yet. Start the conversation.</p>';
    messageInput.disabled = false;
    send.disabled = false;
    say("Connected. Messages are live.");
    db.channel("cuemoo-global-chat")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},event => addMessage(event.new))
      .subscribe(state => {
        if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") say("Live updates disconnected. Refresh to reconnect.",true);
      });
  } catch (error) {
    console.error(error);
    say("Couldn't connect. Check Supabase settings, anonymous sign-in, and SQL setup.",true);
  }
}
nameInput.value = name();
$("chat-save-name").addEventListener("click", saveName);
$("chat-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!user) return;
  if (!name() && !saveName()) return;
  const content = messageInput.value.trim();
  if (!content) return;
  if (Date.now() - lastSent < 3000) { say("Wait a moment before sending again.",true); return; }
  lastSent = Date.now();
  send.disabled = true;
  const {error} = await db.from("chat_messages").insert({user_id:user.id,username:name(),content});
  if (error) { say("Message not sent. Please try again.",true); console.error(error); }
  else { messageInput.value = ""; say("Message sent."); }
  send.disabled = false;
});
start();
