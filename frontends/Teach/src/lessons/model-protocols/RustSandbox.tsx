import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/context";
import { useLocale } from "../../i18n/useLocale";
import { rustExample, rustSandbox } from "../../i18n/rustSandbox";
import "../../ui/RustSandbox.css";
import { RustEditor } from "../../ui/RustEditor";
import { HelpPopover } from "../../ui/HelpPopover";

type Job = {id: string; state: keyof typeof rustSandbox.zh.states; output: string; position: number};
export function RustSandbox() {
 const {user} = useAuth();
 return <SandboxForm key={user?.id ?? "guest"} signedIn={!!user} />;
}
function SandboxForm({signedIn}: {signedIn:boolean}) {
 const {locale}=useLocale();const t=rustSandbox[locale];
 const [source,setSource]=useState(rustExample),[key,setKey]=useState("");
 const [job,setJob]=useState<Job>(),[busy,setBusy]=useState(false),[error,setError]=useState<"error"|"busy"|"unavailable"|"missing">();
 const [retry,setRetry]=useState(0);
 const active=job?.state==="queued"||job?.state==="running";
 function failed(e:unknown){if(e instanceof ApiError&&e.status===404)setJob(undefined);setError(e instanceof ApiError ? e.status===429?"busy":e.status===503?"unavailable":e.status===404?"missing":"error":"error")}
 useEffect(()=>{
  if(!active||!job?.id)return;
  let stopped=false;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
  const poll=async()=>{try{const next=await api<Job>(`/sandbox/jobs/${job.id}`,{signal:controller.signal});if(!stopped){setJob(next);setError(undefined);if(next.state==="queued"||next.state==="running")timer=setTimeout(poll,1500)}}catch(e){if(!stopped)failed(e)}};
  timer=setTimeout(poll,1000);return()=>{stopped=true;clearTimeout(timer);controller.abort()};
 },[active,job?.id,retry]);
 return <section className="lesson-section rust-sandbox">
  <h3>{t.title}</h3><p>{t.intro}</p>
  <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError(undefined);try{const result=await api<Job>("/sandbox/jobs",{method:"POST",body:JSON.stringify({source,key})});setJob(result);setKey("")}catch(err){failed(err)}finally{setBusy(false)}}}>
   <div className="rust-sandbox__editor-heading">
    <div className="rust-sandbox__filename"><label htmlFor="rust-source">main.rs</label><HelpPopover label={t.environment}><p>{t.hint}</p><p>{t.relay}</p></HelpPopover></div>
    <div className="rust-sandbox__actions">
     {signedIn?<button type="submit" disabled={busy||active||!source.trim()}>{busy?t.pending:t.run}</button>:<Link to="/login?next=%2Flessons%2Fmodel-protocols">{t.login}</Link>}
     <button type="button" disabled={busy||active} onClick={()=>setSource(rustExample)}>{t.reset}</button>
     {active&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await api(`/sandbox/jobs/${job!.id}`,{method:"DELETE"});setJob(old=>old&&({...old,state:"cancelled"}));setError(undefined)}catch(e){failed(e)}finally{setBusy(false)}}}>{t.cancel}</button>}
    </div>
   </div>
   <RustEditor value={source} onChange={setSource} disabled={busy||!!active} label={t.source} />
   <p className="rust-sandbox__hint">{t.editorHint}</p>
   <label htmlFor="rust-key">{t.key}</label><input id="rust-key" type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} maxLength={256} disabled={busy||active} />
   {error&&<p role="alert">{t[error]} {active&&<button type="button" onClick={()=>setRetry(n=>n+1)}>{t.retry}</button>}</p>}
   <p role="status">{job ? `${t.states[job.state]}${job.state==="queued"?` · ${t.position} ${job.position}`:""}` : t.empty}</p>
   <pre tabIndex={0} aria-label={t.output}>{job?.output||"—"}</pre>
   <p className="rust-sandbox__hint">{t.privacy}</p>
   <p className="rust-sandbox__hint">{t.openSource} <a href="https://github.com/bushm2092-del/mini-codex" target="_blank" rel="noreferrer">github.com/bushm2092-del/mini-codex</a></p>
   <p className="rust-sandbox__hint">{t.outputPrivacy}</p>
  </form>
 </section>;
}
