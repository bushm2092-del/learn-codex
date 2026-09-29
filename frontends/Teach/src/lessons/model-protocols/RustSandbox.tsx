import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/context";
import { useLocale } from "../../i18n/useLocale";
import { editorSearchPhrases, rustExample, rustSandbox } from "../../i18n/rustSandbox";
import "../../ui/RustSandbox.css";
import { RustEditor } from "../../ui/RustEditor";
import { HelpPopover } from "../../ui/HelpPopover";
import { JsonOutput } from "../../ui/JsonOutput";
import { ResizableTerminal } from "../../ui/ResizableTerminal";
import { CodeWorkspace, type WorkspaceExample } from "../../ui/CodeWorkspace";

type Job = {id: string; state: keyof typeof rustSandbox.zh.states; output: string; position: number};
type RustSandboxProps = {
 initialSource?: string;
 lessonPath?: string;
 title?: string;
 intro?: string;
 empty?: string;
 examples?: WorkspaceExample[];
 exampleId?: string;
};
export function RustSandbox({initialSource=rustExample,lessonPath="/lessons/model-protocols",title,intro,empty,examples,exampleId}: RustSandboxProps = {}) {
 const {user} = useAuth();
 return <SandboxForm key={user?.id ?? "guest"} signedIn={!!user} initialSource={initialSource} lessonPath={lessonPath} title={title} intro={intro} empty={empty} examples={examples} exampleId={exampleId} />;
}
function SandboxForm({signedIn,initialSource,lessonPath,title,intro,empty,examples,exampleId}: {signedIn:boolean} & Required<Pick<RustSandboxProps,"initialSource"|"lessonPath">> & Pick<RustSandboxProps,"title"|"intro"|"empty"|"examples"|"exampleId">) {
 const {locale}=useLocale();const t=rustSandbox[locale];
 const sourceId=useId(),keyId=useId();
 const [source,setSource]=useState(initialSource),[key,setKey]=useState("");
 const [job,setJob]=useState<Job>(),[busy,setBusy]=useState(false),[error,setError]=useState<"error"|"busy"|"unavailable"|"missing">();
 const [retry,setRetry]=useState(0);
 const active=job?.state==="queued"||job?.state==="running";
 const loading=busy||active;
 const progress=active?t.states[job.state]:t.pending;
 function failed(e:unknown){if(e instanceof ApiError&&e.status===404)setJob(undefined);setError(e instanceof ApiError ? e.status===429?"busy":e.status===503?"unavailable":e.status===404?"missing":"error":"error")}
 useEffect(()=>{
  if(!active||!job?.id)return;
  let stopped=false;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
  const poll=async()=>{try{const next=await api<Job>(`/sandbox/jobs/${job.id}`,{signal:controller.signal});if(!stopped){setJob(next);setError(undefined);if(next.state==="queued"||next.state==="running")timer=setTimeout(poll,1500)}}catch(e){if(!stopped)failed(e)}};
  timer=setTimeout(poll,1000);return()=>{stopped=true;clearTimeout(timer);controller.abort()};
 },[active,job?.id,retry]);
 return <section className="lesson-section rust-sandbox">
  <h3>{title??t.title}</h3><p>{intro??t.intro}</p>
  <CodeWorkspace openLabel={t.splitOpen} closeLabel={t.splitClose} title={t.splitTitle} resizeLabel={t.splitResize} fullscreenLabel={t.splitFullscreen} restoreLabel={t.splitRestore} movedLabel={t.splitMoved} examples={examples} exampleId={exampleId} catalogLabel={t.codeCatalog} readonlyLabel={t.codeReadonly}>
  {controls => <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError(undefined);try{const result=await api<Job>("/sandbox/jobs",{method:"POST",body:JSON.stringify({source,key})});setJob(result)}catch(err){failed(err)}finally{setBusy(false)}}}>
   <div className="rust-sandbox__workspace">
    <div className="rust-sandbox__editor-heading">
     <div className="rust-sandbox__filename"><label htmlFor={sourceId}>main.rs</label><HelpPopover label={t.environment}>
      <p><strong>{t.environment}</strong></p>
      <p>{t.editorHint}</p><p>{t.hint}</p><p>{t.relay}</p>
      <p>{t.privacy}</p><p>{t.outputPrivacy}</p>
      <p>{t.openSource} <a href="https://github.com/bushm2092-del/mini-codex" target="_blank" rel="noreferrer">github.com/bushm2092-del/mini-codex</a></p>
     </HelpPopover>{controls}</div>
     <div className="rust-sandbox__header-key">
      <label htmlFor={keyId}>{t.key}</label>
      <input id={keyId} type="password" autoComplete="off" placeholder={t.keyPlaceholder} title={t.key} value={key} onChange={e=>setKey(e.target.value)} maxLength={256} disabled={busy||active} />
     </div>
     <div className="rust-sandbox__actions">
      {signedIn?<button type="submit" disabled={loading||!source.trim()} aria-busy={loading}>{loading&&<span className="rust-sandbox__spinner" aria-hidden="true" />}{loading?progress:t.run}</button>:<Link to={`/login?next=${encodeURIComponent(lessonPath)}`}>{t.login}</Link>}
      <button type="button" disabled={busy||active} onClick={()=>setSource(initialSource)}>{t.reset}</button>
      {active&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{await api(`/sandbox/jobs/${job!.id}`,{method:"DELETE"});setJob(old=>old&&({...old,state:"cancelled"}));setError(undefined)}catch(e){failed(e)}finally{setBusy(false)}}}>{t.cancel}</button>}
     </div>
    </div>
    <RustEditor id={sourceId} value={source} onChange={setSource} disabled={busy||!!active} label={t.source} phrases={editorSearchPhrases[locale]} />
    {error&&<p className="rust-sandbox__error" role="alert">{t[error]} {active&&<button type="button" onClick={()=>setRetry(n=>n+1)}>{t.retry}</button>}</p>}
    <ResizableTerminal label={t.output} resizeLabel={t.outputResize} status={
      <span role="status" className="rust-sandbox__status">{loading&&<span className="rust-sandbox__spinner" aria-hidden="true" />}{busy&&!active?t.pending:job ? `${t.states[job.state]}${job.state==="queued"?` · ${t.position} ${job.position}`:""}` : empty??t.empty}</span>
    }><JsonOutput output={job?.output ?? ""} label={t.output} /></ResizableTerminal>
   </div>
  </form>}
  </CodeWorkspace>
 </section>;
}
