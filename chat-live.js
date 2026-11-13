import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const db=createClient("https://yiapojosvsvsswgrcupk.supabase.co","sb_publishable_FBsP-RmhkkUTl5Wy-bJvAQ_oY-eavez",{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:"cuemoo-auth-v1"}});
const $=id=>document.getElementById(id),status=$("chat-status"),messages=$("chat-messages");
let user=null,username="",mode="signup",lastGlobal=0,lastDM=0,seen=new Set(),friends=[],isBanned=false;
window.cuemooAccountStatus="checking";
const say=(s,e=false)=>{status.textContent=s;status.classList.toggle("error",e)};
const el=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n};
const btn=(txt,fn)=>{const b=el("button","",txt);b.type="button";b.onclick=fn;return b};
const email=u=>u+"@accounts.cuemoo.invalid";
function view(v){document.querySelectorAll(".social-view").forEach(x=>x.classList.add("hidden"));$("view-"+v).classList.remove("hidden");document.querySelectorAll("[data-social]").forEach(x=>x.classList.toggle("active",x.dataset.social===v));if(v==="friends")loadFriends();if(v==="profile")loadProfile();if(v==="owner")loadReports()}
function card(p,actions){const c=el("div","social-person"),d=el("div","",p.display_name||p.username),a=el("div","social-actions");d.append(el("small","","@"+p.username));actions.forEach(x=>a.append(btn(x[0],x[1])));c.append(d,a);return c}
async function globalLoad(){if(isBanned)return;seen.clear();const {data,error}=await db.from("chat_messages").select("id,user_id,username,content,created_at").order("created_at",{ascending:false}).limit(50);messages.replaceChildren();if(error){say("Could not load global chat.",true);return}data.reverse().forEach(addMsg);if(!messages.children.length)messages.append(el("p","chat-empty","No messages yet."));$("chat-message").dataset.ready="1";$("chat-send").dataset.ready="1";$("chat-message").disabled=$("chat-send").disabled=isBanned;say("Connected. Messages are live.")}
function addMsg(m){if(seen.has(m.id))return;seen.add(m.id);const a=el("article","chat-message"),h=el("div","chat-message-top"),n=el("strong","chat-message-name",m.username),t=el("time","",new Date(m.created_at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}));h.append(n,t);a.append(h,el("div","chat-message-body",m.content));messages.append(a);messages.scrollTop=messages.scrollHeight}
function applyBanState(banned){
 isBanned=!!banned;
 window.cuemooBanned=isBanned;
 window.cuemooAccountStatus=isBanned?"banned":"allowed";
 const banner=$("ban-banner");
 if(banner)banner.classList.toggle("hidden",!isBanned);
 ["chat-message","chat-send","dm-input","dm-send"].forEach(id=>{const n=$(id);if(n)n.disabled=isBanned||!n.dataset.ready});
 if(isBanned)say("🚫 BANNED — your account remains signed in, but games and chat are disabled.",true);
 document.dispatchEvent(new CustomEvent("cuemoo:ban-status",{detail:{banned:isBanned}}));
}
async function enter(profile){
 username=profile.username;
 $("chat-current-user").textContent=username;
 $("chat-auth").classList.add("hidden");
 $("chat-room").classList.remove("hidden");
 document.querySelectorAll("[data-social]").forEach(b=>b.onclick=()=>view(b.dataset.social));
 view("global");
 const {data:p}=await db.from("chat_profiles").select("role,is_banned").eq("id",user.id).single();
 applyBanState(!!p?.is_banned);
 if(!isBanned){
  globalLoad();
  db.channel("cuemoo-global").on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages"},e=>addMsg(e.new)).subscribe();
 }
 if(["owner","moderator"].includes(p?.role))$("owner-tab").classList.remove("hidden");
 db.channel("cuemoo-own-profile").on("postgres_changes",{event:"UPDATE",schema:"public",table:"chat_profiles",filter:"id=eq."+user.id},e=>applyBanState(!!e.new.is_banned)).subscribe();
}
$("chat-auth-form").addEventListener("submit",async e=>{e.preventDefault();const u=$("chat-auth-username").value.trim().toLowerCase(),pw=$("chat-auth-password").value;if(!/^[a-z0-9_]{3,20}$/.test(u)||pw.length<8){say("Use a 3–20 character username and password of at least 8 characters.",true);return}const b=$("chat-auth-submit");b.disabled=true;try{let r=mode==="signup"?await db.auth.signUp({email:email(u),password:pw,options:{data:{username:u}}}):await db.auth.signInWithPassword({email:email(u),password:pw});if(r.error)throw r.error;if(!r.data.session)throw Error("Turn OFF email confirmation in Supabase Auth settings.");user=r.data.user;const {data:p,error}=await db.from("chat_profiles").select("username,is_banned").eq("id",user.id).single();if(error||!p)throw Error("Profile missing. Check the profile trigger.");$("chat-auth-password").value="";await enter(p);say("Welcome to CueMoo!")}catch(x){const msg=String(x.message||"");say(msg.toLowerCase().includes("already registered")||msg.toLowerCase().includes("already been registered")?"That username already has an account. Switch to Log in instead.":msg.toLowerCase().includes("invalid login")?"That username or password did not match. Check both and try Log in again.":msg,true)}finally{b.disabled=false}});
function setAuthMode(next){
 mode=next==="login"?"login":"signup";
 document.querySelectorAll("[data-auth-mode]").forEach(x=>{
  const active=x.dataset.authMode===mode;
  x.classList.toggle("active",active);
  x.setAttribute("aria-pressed",String(active));
 });
 $("chat-auth-submit").textContent=mode==="signup"?"Create account":"Log in";
 $("chat-auth-password").setAttribute("autocomplete",mode==="login"?"current-password":"new-password");
 say(mode==="login"?"Log in with your existing username and password.":"Create a new CueMoo account.");
}
document.querySelectorAll("[data-auth-mode]").forEach(b=>{
 b.type="button";
 b.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();setAuthMode(b.dataset.authMode)});
});
setAuthMode("signup");
$("chat-logout").onclick=async()=>{await db.auth.signOut();location.reload()};
$("chat-form").addEventListener("submit",async e=>{e.preventDefault();const content=$("chat-message").value.trim();if(!content)return;if(isBanned){say("🚫 BANNED — chat is disabled.",true);return}if(Date.now()-lastGlobal<30000){say("Global chat cooldown: wait "+Math.ceil((30000-(Date.now()-lastGlobal))/1000)+" seconds.",true);return}lastGlobal=Date.now();const {error}=await db.from("chat_messages").insert({user_id:user.id,username,content});if(error){lastGlobal=0;say(error.message||"Message not sent.",true)}else{$("chat-message").value="";say("Sent. Global chat cooldown: 30 seconds.")}});
async function loadFriends(){const req=$("friend-requests"),list=$("friend-list");req.replaceChildren();list.replaceChildren();const {data:rs,error}=await db.from("friend_requests").select("*").or("sender_id.eq."+user.id+",receiver_id.eq."+user.id).eq("status","pending");if(error){req.append(el("p","chat-empty","Could not load requests."));return}for(const r of rs){const id=r.sender_id===user.id?r.receiver_id:r.sender_id,{data:p}=await db.from("chat_profiles").select("id,username,display_name,bio").eq("id",id).maybeSingle();if(p)req.append(card(p,[["View profile",()=>showPublicProfile(p.id)],...(r.receiver_id===user.id?[["Accept",()=>respond(r.id,"accepted")],["Decline",()=>respond(r.id,"declined")]]:[["Pending",()=>{}]])]))}if(!req.children.length)req.append(el("p","chat-empty","No pending requests."));const {data:rs2}=await db.from("friend_requests").select("sender_id,receiver_id").eq("status","accepted").or("sender_id.eq."+user.id+",receiver_id.eq."+user.id);friends=[];for(const r of rs2||[]){const id=r.sender_id===user.id?r.receiver_id:r.sender_id,{data:p}=await db.from("chat_profiles").select("id,username,display_name,bio").eq("id",id).maybeSingle();if(p&&!friends.some(x=>x.id===id))friends.push(p)}friends.forEach(p=>list.append(card(p,[["View profile",()=>showPublicProfile(p.id)],["DM",()=>{fillDM();$("dm-friend").value=p.id;view("messages");loadDM()}],["Remove friend",()=>removeFriend(p.id)]])));if(!friends.length)list.append(el("p","chat-empty","No friends yet."));fillDM()}
async function respond(id,statusValue){const {error}=await db.from("friend_requests").update({status:statusValue}).eq("id",id);say(error?"Request update failed.":"Request updated.",!!error);loadFriends()}
$("friend-search-btn").onclick=async()=>{const q=$("friend-search").value.trim(),box=$("friend-results");box.replaceChildren();if(q.length<3){box.append(el("p","chat-empty","Enter 3 or more characters."));return}const {data,error}=await db.from("chat_profiles").select("id,username,display_name").ilike("username","%"+q+"%").neq("id",user.id).limit(15);if(error){say("Search failed.",true);return}for(const p of data){const {data:old}=await db.from("friend_requests").select("id,status").or("and(sender_id.eq."+user.id+",receiver_id.eq."+p.id+"),and(sender_id.eq."+p.id+",receiver_id.eq."+user.id+")").limit(1).maybeSingle();box.append(card(p,[["View profile",()=>showPublicProfile(p.id)],[old?(old.status==="accepted"?"Friends":"Pending"):"Add friend",async()=>{if(old)return;const {error:e}=await db.from("friend_requests").insert({sender_id:user.id,receiver_id:p.id});say(e?"Could not send request.":"Request sent.",!!e);$("friend-search-btn").click()}]]))}if(!box.children.length)box.append(el("p","chat-empty","No matches."))};
function fillDM(){const s=$("dm-friend"),v=s.value;s.replaceChildren(new Option("Choose friend",""));friends.forEach(p=>s.add(new Option(p.display_name||p.username,p.id)));s.value=v}
$("dm-friend").onchange=()=>loadDM();$("dm-refresh").onclick=()=>loadDM();
async function loadDM(){const id=$("dm-friend").value,box=$("dm-messages");box.replaceChildren();if(!id){$("dm-input").disabled=$("dm-send").disabled=true;return}const {data,error}=await db.from("direct_messages").select("*").or("and(sender_id.eq."+user.id+",receiver_id.eq."+id+"),and(sender_id.eq."+id+",receiver_id.eq."+user.id+")").order("created_at").limit(100);if(error){box.append(el("p","chat-empty","Could not load DMs; confirm friendship is accepted."));return}data.forEach(m=>box.append(el("div","social-bubble",(m.sender_id===user.id?"You: ":"Them: ")+m.content)));$("dm-input").dataset.ready="1";$("dm-send").dataset.ready="1";$("dm-input").disabled=$("dm-send").disabled=isBanned}
$("dm-form").onsubmit=async e=>{e.preventDefault();const receiver_id=$("dm-friend").value,content=$("dm-input").value.trim();if(!receiver_id||!content)return;if(isBanned){say("🚫 BANNED — messaging is disabled.",true);return}if(Date.now()-lastDM<15000){say("Private message cooldown: wait "+Math.ceil((15000-(Date.now()-lastDM))/1000)+" seconds.",true);return}lastDM=Date.now();const {error}=await db.from("direct_messages").insert({sender_id:user.id,receiver_id,content});if(error){lastDM=0;say(error.message||"DM failed. Check friendship and policies.",true)}else{$("dm-input").value="";say("Sent. Private message cooldown: 15 seconds.");loadDM()}};

async function showPublicProfile(id){
 const box=$("public-profile");box.classList.remove("hidden");box.replaceChildren(el("p","chat-empty","Loading profile…"));
 const {data:p,error}=await db.from("chat_profiles").select("id,username,display_name,bio").eq("id",id).maybeSingle();
 box.replaceChildren();
 if(error||!p){box.append(el("p","chat-empty","Could not load that profile."));return}
 const head=el("div","public-profile-head",p.display_name||p.username);
 head.append(el("small","","@"+p.username));
 const bio=el("p","public-profile-bio",p.bio||"This player hasn't added a bio yet.");
 const actions=el("div","social-actions");
 const {data:rel}=await db.from("friend_requests").select("id,status,sender_id,receiver_id").or("and(sender_id.eq."+user.id+",receiver_id.eq."+id+"),and(sender_id.eq."+id+",receiver_id.eq."+user.id+")").limit(1).maybeSingle();
 if(rel?.status==="accepted")actions.append(btn("Remove friend",()=>removeFriend(id)));
 else if(!rel)actions.append(btn("Add friend",async()=>{const {error:e}=await db.from("friend_requests").insert({sender_id:user.id,receiver_id:id});say(e?"Friend request failed.":"Friend request sent.",!!e);showPublicProfile(id)}));
 else actions.append(el("span","profile-state",rel.status==="pending"?"Friend request pending":"Request status: "+rel.status));
 box.append(head,bio,actions,btn("Close profile",()=>box.classList.add("hidden")));
}
async function removeFriend(id){
 const {error}=await db.from("friend_requests").delete().or("and(sender_id.eq."+user.id+",receiver_id.eq."+id+"),and(sender_id.eq."+id+",receiver_id.eq."+user.id+")").eq("status","accepted");
 say(error?"Could not remove friend. Run the updated owner SQL setup.":"Friend removed.",!!error);
 if(!error){$("public-profile").classList.add("hidden");loadFriends()}
}

async function loadProfile(){const {data,error}=await db.from("chat_profiles").select("display_name,bio").eq("id",user.id).single();if(error){say("Profile load failed.",true);return}$("profile-display").value=data.display_name||username;$("profile-bio").value=data.bio||""}
$("profile-save").onclick=async()=>{const patch={display_name:$("profile-display").value.trim().slice(0,30)||username,bio:$("profile-bio").value.trim().slice(0,160)};const {error}=await db.from("chat_profiles").update(patch).eq("id",user.id);say(error?"Profile save failed; check profile update policy.":"Profile saved.",!!error);loadProfile()};
async function loadReports(){
 const {data:p}=await db.from("chat_profiles").select("role").eq("id",user.id).single(),box=$("owner-users");box.replaceChildren();
 if(p?.role!=="owner"){box.append(el("p","chat-empty","Owner access required for member management."));return}
 const [{count:members},{count:reports},{count:msgs}]=await Promise.all([db.from("chat_profiles").select("*",{count:"exact",head:true}),db.from("chat_reports").select("*",{count:"exact",head:true}),db.from("chat_messages").select("*",{count:"exact",head:true})]);
 $("stat-members").textContent=members??"—";$("stat-reports").textContent=reports??"—";$("stat-messages").textContent=msgs??"—";
 const {data,error}=await db.from("chat_reports").select("id,message_id").order("created_at",{ascending:false}).limit(50);
 if(error){box.append(el("p","chat-empty","Could not load reports."));return}
 for(const r of data||[]){const {data:m}=await db.from("chat_messages").select("username,content").eq("id",r.message_id).maybeSingle(),row=el("div","owner-report",m?m.username+": "+m.content:"Message no longer exists"),actions=el("div","social-actions");
 if(m)actions.append(btn("Delete message",async()=>{const {error:e}=await db.from("chat_messages").delete().eq("id",r.message_id);say(e?"Delete failed.":"Message deleted.",!!e);loadReports()}));
 actions.append(btn("Dismiss",async()=>{const {error:e}=await db.from("chat_reports").delete().eq("id",r.id);say(e?"Dismiss failed.":"Report dismissed.",!!e);loadReports()}));row.append(actions);box.append(row)}
 if(!box.children.length)box.append(el("p","chat-empty","No reports to review."));
}
async function searchOwnerMembers(){
 const q=$("owner-search").value.trim().toLowerCase(),box=$("owner-member-results");box.replaceChildren();
 if(q.length<2){box.append(el("p","chat-empty","Enter at least 2 characters."));return}
 const {data,error}=await db.from("chat_profiles").select("id,username,display_name,role,is_banned").ilike("username","%"+q+"%").limit(20);
 if(error){say("Member search failed. Run the owner SQL setup.",true);return}
 for(const p of data||[]){const row=el("div","owner-member"),info=el("div","owner-member-info",p.display_name||p.username),actions=el("div","social-actions");info.append(el("small","","@"+p.username+" · "+p.role+(p.is_banned?" · BANNED":"")));
 if(p.id!==user.id){const role=p.role==="moderator"?"member":"moderator";actions.append(btn(p.role==="moderator"?"Remove moderator":"Make moderator",async()=>{if(!confirm((role==="moderator"?"Promote ":"Remove moderator from ")+p.username+"?"))return;const {error:e}=await db.from("chat_profiles").update({role}).eq("id",p.id);say(e?"Role update failed. Run owner SQL setup first.":"Role updated.",!!e);searchOwnerMembers()}));actions.append(btn(p.is_banned?"Unban":"Ban",async()=>{if(!confirm((p.is_banned?"Unban ":"Ban ")+p.username+"?"))return;const {error:e}=await db.from("chat_profiles").update({is_banned:!p.is_banned}).eq("id",p.id);say(e?"Account action failed.":"Account status updated.",!!e);searchOwnerMembers()}))}
 row.append(info,actions);box.append(row)}
 if(!box.children.length)box.append(el("p","chat-empty","No matching members."));
}
$("owner-search-btn").addEventListener("click",searchOwnerMembers);
$("owner-search").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchOwnerMembers()}});
async function start(){
 const {data:{session},error}=await db.auth.getSession();
 if(error){window.cuemooAccountStatus="allowed";say("Supabase connection failed.",true);return}
 if(session?.user){
  user=session.user;
  const {data:p,error}=await db.from("chat_profiles").select("username,is_banned").eq("id",user.id).single();
  if(error||!p){window.cuemooAccountStatus="allowed";say("Profile not found.",true);return}
  await enter(p);
 }else{window.cuemooAccountStatus="allowed";window.cuemooBanned=false;say("Create an account or log in to join chat.")}
}
start();