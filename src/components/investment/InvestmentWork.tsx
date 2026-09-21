import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, SectionHeading } from "@/components/ui/card"
import { useWrite, writeErrorText } from "@/lib/writes"
import { getInvestmentWork, addInvestmentWork, saveInvestmentWork, type InvestmentWork, type InvestmentWatch } from "@/lib/investment"
import { isCanonicalActionId, workPanelView } from "@/lib/investmentFormat"
import { ReadingText } from "./ReadingText"

export function SourceQuestion({source}: {source: {id:string; topic:string; source:{path:string}}}) {
  const mutation=useWrite(addInvestmentWork,["investment-work"])
  const [question,setQuestion]=useState(`${source.topic}：這份研究有哪些問題還需要確認？`)
  return <div className="flex flex-col gap-2">
    <label className="flex flex-col gap-1 text-caption text-ink-3">我想確認的問題<input value={question} maxLength={500} onChange={e=>setQuestion(e.target.value)} className="min-w-0 rounded-sm border border-line bg-paper p-2 text-body text-ink"/></label>
    <div className="flex flex-wrap gap-2"><Button disabled={mutation.isPending||!question.trim()} onClick={()=>mutation.mutate({kind:"decision",text:question,source_id:source.id,source_label:source.source.path})}>加入待決策</Button><Button disabled={mutation.isPending||!question.trim()} onClick={()=>mutation.mutate({kind:"research",text:question,source_id:source.id,source_label:source.source.path})}>加入待研究</Button></div>
    {mutation.isSuccess?<p role="status" className="text-caption text-ink-3">已保存到待處理清單。</p>:null}
    {mutation.isError?<p role="alert" className="text-caption text-warn">{writeErrorText(mutation.error)}</p>:null}
  </div>
}

function WorkItem({item}: {item:InvestmentWork}) {
  const [draft,setDraft]=useState(item)
  const [open,setOpen]=useState(false)
  const [copied,setCopied]=useState("")
  const outdated=draft.version!==item.version
  const mutation=useWrite(saveInvestmentWork,["investment-work"])
  const prompt=`請協助分析這個投資問題：${item.text}\n來源：${item.source_label||"我在 PersonalOS 提出的問題"}${item.source_id?`（${item.source_id}）`:""}\n目前結論：${draft.conclusion||"尚未記錄"}\n請先讀取上述來源，指出結論、反證與尚缺的資料。讀不到來源請明說，不要猜；先提出分析，不修改持倉或論點。`
  async function copy() {try {await navigator.clipboard.writeText(prompt);setCopied("已複製。貼到你選用的 AI 對話即可，尚未送出。")}catch{setCopied("未能複製，請展開下方文字手動選取。")}}
  function save(status: InvestmentWork["status"]) {mutation.mutate({...draft,status},{onSuccess: value=>setDraft(value)})}
  return <Card className="flex flex-col gap-2 p-3">
    <div className="flex items-start justify-between gap-2"><button className="text-left text-body font-medium text-ink" onClick={()=>setOpen(!open)} aria-expanded={open}>{item.text}</button><span className="shrink-0 text-caption text-ink-3">{item.status==="done"?"已結束":item.status==="watching"?"繼續追蹤":"待處理"}</span></div>
    {isCanonicalActionId(item.source_id)?<p className="text-caption text-ink-3">正式編號 {item.source_id}。要在正式判斷頁寫下這個編號才算結案。</p>:null}
    {item.conclusion&&!open?<p className="line-clamp-2 text-body text-ink-2">結論：{item.conclusion}</p>:null}
    <div className="flex flex-wrap gap-2"><Button onClick={()=>setOpen(!open)}>{open?"收起":"填寫結論／處理"}</Button><Button disabled={outdated} onClick={()=>void copy()}>複製問題給 AI</Button></div>
    {copied?<p role="status" className="text-caption text-ink-3">{copied}</p>:null}
    {outdated?<div role="status" className="flex flex-col gap-2 text-caption text-warn"><p>這個事項已有新版。可先複製未保存的結論；載入新版會替換編輯中的文字。</p><div className="flex flex-wrap gap-2"><Button onClick={()=>{void navigator.clipboard.writeText(draft.conclusion).then(()=>setCopied("已複製未保存的結論。"),()=>{setOpen(true);setCopied("未能複製，請在結論欄選取文字備份。")})}}>複製未保存結論</Button><Button onClick={()=>{setDraft(item);mutation.reset();setCopied("")}}>載入新版</Button></div></div>:null}
    {open?<div className="flex flex-col gap-2">
      {item.source_label?<p className="break-words text-caption text-ink-3">來源：{item.source_label}</p>:null}
      <label className="flex flex-col gap-1 text-caption text-ink-3">分類<select className="rounded-sm border border-line bg-paper p-2 text-body text-ink" value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value as InvestmentWork["kind"]})}><option value="decision">要我決定</option><option value="research">還要研究</option></select></label>
      <label className="flex flex-col gap-1 text-caption text-ink-3">我的結論／下一步<textarea className="min-h-[88px] rounded-sm border border-line bg-paper p-2 text-body text-ink" maxLength={4000} value={draft.conclusion} onChange={e=>setDraft({...draft,conclusion:e.target.value})} placeholder="例如：先維持原判斷，下次財報再確認。"/></label>
      <div className="flex flex-wrap gap-2"><Button disabled={mutation.isPending||outdated} onClick={()=>save(draft.status)}>保存結論</Button><Button disabled={mutation.isPending||outdated} onClick={()=>save("watching")}>繼續追蹤</Button><Button disabled={mutation.isPending||outdated} onClick={()=>save(item.status==="done"?"open":"done")}>{item.status==="done"?"重新打開":"確認並結束"}</Button></div>
      <details><summary className="cursor-pointer text-caption text-ink-3">給 AI 的提問文字</summary><textarea readOnly aria-label="给 AI 的提問文字" value={prompt} className="min-h-[120px] w-full rounded-sm border border-line p-2 text-body"/></details>
      {mutation.isSuccess?<p role="status" className="text-caption text-ok">已保存。</p>:null}
      {mutation.isError?<p role="alert" className="text-caption text-warn">{writeErrorText(mutation.error)}</p>:null}
    </div>:null}
  </Card>
}

export function InvestmentWorkPanel({research}: {research: InvestmentWatch["research"]}) {
  const query=useQuery({queryKey:["investment-work"],queryFn:getInvestmentWork,refetchOnWindowFocus:false})
  const create=useWrite(addInvestmentWork,["investment-work"])
  const [kind,setKind]=useState<InvestmentWork["kind"]>("decision")
  const [text,setText]=useState("")
  const [showDone,setShowDone]=useState(false)
  const view=workPanelView(query)
  const showList=view==="stale"||view==="empty"||view==="ready"
  const items=showList?(query.data?.items??[]):[]
  const doneCount=items.filter(i=>i.status==="done").length
  const candidates=research.filter(r=>r.status==="candidate" && /owner 拍板|對標名單/.test(r.source.section) && !items.some(i=>i.source_id===r.id))
  return <section className="flex flex-col gap-4" aria-label="投資待處理事項">
    {view==="loading"?<p role="status" className="text-body text-ink-3">讀取待處理事項中…</p>:null}
    {view==="error"?<p role="alert" className="text-body text-warn">待處理清單讀取失敗，請按更新資料。</p>:null}
    {showList?<>
    <form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();create.mutate({kind,text:text.trim()},{onSuccess:()=>setText("")})}}>
      <select aria-label="新增事項分類" className="rounded-sm border border-line bg-paper p-2 text-body" value={kind} onChange={e=>setKind(e.target.value as InvestmentWork["kind"])}><option value="decision">要我決定</option><option value="research">還要研究</option></select>
      <input aria-label="要處理的投資問題" className="min-w-0 flex-1 rounded-sm border border-line bg-paper p-2 text-body" maxLength={500} value={text} onChange={e=>setText(e.target.value)} placeholder="記下一個需要決定或研究的問題…"/>
      <Button type="submit" disabled={!text.trim()||create.isPending}>加入清單</Button>
    </form>
    {view==="stale"?<p role="alert" className="text-body text-warn">待處理清單更新失敗。以下是先前內容，不是最新；完成筆數不能當成目前進度。</p>:null}
    {create.isError?<p role="alert" className="text-body text-warn">{writeErrorText(create.error)}</p>:null}
    {(["decision","research"] as const).map(group=><section key={group} className="flex flex-col gap-2"><SectionHeading>{group==="decision"?"要我決定":"還要研究"}</SectionHeading>{items.filter(i=>i.kind===group&&i.status!=="done").map(i=><WorkItem key={i.id} item={i}/>)}{!items.some(i=>i.kind===group&&i.status!=="done")?<p className="text-body text-ink-3">尚未加入事項。</p>:null}
      {group==="decision"&&candidates.length>0?<div className="flex flex-col gap-2"><p className="text-caption text-ink-3">研究文件中另有以下待確認事項；加入後可保存你的結論。</p>{candidates.map(r=><Card key={r.id} className="flex flex-col gap-2 p-3"><p className="text-body font-medium">{r.topic}：選擇判斷指標</p><details><summary className="cursor-pointer text-caption text-ink-3">查看原文選項</summary><ReadingText text={r.excerpt}/></details><SourceQuestion source={r}/></Card>)}</div>:null}
    </section>)}
    <div><Button onClick={()=>setShowDone(!showDone)}>{showDone?"收起已結束":"查看已結束"}{view==="stale"?"（先前內容）":`（${doneCount}）`}</Button></div>
    {showDone?items.filter(i=>i.status==="done").map(i=><WorkItem key={i.id} item={i}/>):null}
    <p className="text-caption text-ink-3">在這裡「保存結論」或「確認並結束」，只會更新 PersonalOS 本機筆記。不會改寫 Investment Note 的論點，也不會把正式行動編號標成結案。</p>
    </>:null}
  </section>
}
