const rawLanguages=[
  ["auto","Auto Detect"],["en","English"],["hi","Hindi"],["bn","Bengali"],["ta","Tamil"],["te","Telugu"],
  ["mr","Marathi"],["gu","Gujarati"],["kn","Kannada"],["ml","Malayalam"],["pa","Punjabi"],["ur","Urdu"],
  ["ne","Nepali"],["si","Sinhala"],["ar","Arabic"],["fa","Persian"],["he","Hebrew"],["fr","French"],
  ["de","German"],["es","Spanish"],["it","Italian"],["pt","Portuguese"],["ru","Russian"],["uk","Ukrainian"],
  ["pl","Polish"],["nl","Dutch"],["tr","Turkish"],["el","Greek"],["sv","Swedish"],["da","Danish"],
  ["no","Norwegian"],["fi","Finnish"],["cs","Czech"],["ro","Romanian"],["hu","Hungarian"],["id","Indonesian"],
  ["ms","Malay"],["th","Thai"],["vi","Vietnamese"],["ja","Japanese"],["ko","Korean"],["zh","Chinese"],
  ["sw","Swahili"],["af","Afrikaans"],["fil","Filipino"],["am","Amharic"],["az","Azerbaijani"],
  ["ka","Georgian"],["kk","Kazakh"],["uz","Uzbek"]
];
// de-dupe by code, keep first occurrence
const seen=new Set();
const languages=rawLanguages.filter(([code])=>seen.has(code)?false:(seen.add(code),true));
const langName=code=>(languages.find(l=>l[0]===code)||[,code])[1];

const $=id=>document.getElementById(id);
const source=$("source"), target=$("target"), input=$("input"), output=$("output");
const status=$("status"), detected=$("detected"), connector=document.querySelector(".connector");

languages.forEach(([v,n])=>{source.add(new Option(n,v));target.add(new Option(n,v))});
source.value="auto"; target.value="hi";

let timer=null, lastText="", lastSource="", lastTarget="", requestId=0;

function setStatus(t){status.textContent=t}
function setBusy(b){
  connector.classList.toggle("busy",b);
  [$("mic"),$("clear"),$("copy"),$("download"),$("speak"),source,target,$("swap")].forEach(el=>el.disabled=b);
}

function updateCount(){$("count").textContent=`${input.value.length} characters`}

async function translate(){
  const text=input.value.trim();
  if(!text){
    output.value="";
    setStatus("Ready");
    detected.textContent=source.value==="auto"?"Auto detect":langName(source.value);
    return;
  }
  if(text===lastText && source.value===lastSource && target.value===lastTarget) return;
  lastText=text; lastSource=source.value; lastTarget=target.value;

  const myId=++requestId;
  setStatus("Translating\u2026");
  setBusy(true);

  try{
    const result=await translateWithFallback(text,source.value,target.value);
    if(myId!==requestId) return; // a newer request has superseded this one

    output.value=result.translatedText||"";
    setStatus(`Translated \u00b7 ${result.provider}`);
    if(source.value==="auto" && result.detectedLanguage){
      detected.textContent=`Detected: ${langName(result.detectedLanguage)}`;
    }else{
      detected.textContent=source.value==="auto"?"Auto detect":langName(source.value);
    }
  }catch(e){
    if(myId!==requestId) return;
    output.value="Demo translation service is unavailable right now. Connect the secure Gemini backend for production use.";
    setStatus("Service unavailable");
  }finally{
    if(myId===requestId) setBusy(false);
  }
}

// Public, keyless demo endpoints. No secret/API key is stored in this GitHub version.
async function translateViaGoogle(text,src,tgt){
  const params=new URLSearchParams({client:"gtx",sl:src,tl:tgt,dt:"t",q:text});
  const r=await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
  if(!r.ok) throw new Error("google unavailable");
  const d=await r.json();
  const text_out=(d[0]||[]).map(seg=>seg[0]).join("");
  if(!text_out) throw new Error("empty google result");
  return {translatedText:text_out, detectedLanguage:d[2]||null, provider:"Google"};
}

async function translateViaMyMemory(text,src,tgt){
  // MyMemory has no auto-detect and a ~500 byte per-request limit; used as a fallback only.
  const safeSrc=src==="auto"?"en":src;
  const chunk=text.slice(0,480);
  const params=new URLSearchParams({q:chunk,langpair:`${safeSrc}|${tgt}`});
  const r=await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`);
  if(!r.ok) throw new Error("mymemory unavailable");
  const d=await r.json();
  const text_out=d && d.responseData && d.responseData.translatedText;
  if(!text_out) throw new Error("empty mymemory result");
  return {translatedText:text_out, detectedLanguage:null, provider:"MyMemory"};
}

async function translateWithFallback(text,src,tgt){
  try{
    return await translateViaGoogle(text,src,tgt);
  }catch(e){
    return await translateViaMyMemory(text,src,tgt);
  }
}

function schedule(){
  clearTimeout(timer);
  if(!$("realtime").checked) return;
  timer=setTimeout(translate,650);
}

input.addEventListener("input",()=>{updateCount();schedule()});
$("realtime").addEventListener("change",()=>{if($("realtime").checked) schedule()});
source.addEventListener("change",()=>{
  detected.textContent=source.value==="auto"?"Auto detect":langName(source.value);
  translate();
});
target.addEventListener("change",translate);

$("swap").onclick=()=>{
  if(source.value==="auto") return;
  [source.value,target.value]=[target.value,source.value];
  [input.value,output.value]=[output.value,input.value];
  lastText=""; updateCount();
  detected.textContent=langName(source.value);
};

$("clear").onclick=()=>{
  input.value=""; output.value=""; lastText="";
  updateCount(); setStatus("Ready");
  detected.textContent=source.value==="auto"?"Auto detect":langName(source.value);
};

$("copy").onclick=async()=>{
  if(!output.value) return;
  await navigator.clipboard.writeText(output.value);
  setStatus("Copied");
};

$("download").onclick=()=>{
  if(!output.value) return;
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([output.value],{type:"text/plain;charset=utf-8"}));
  a.download="translation.txt";
  a.click();
  URL.revokeObjectURL(a.href);
};

$("speak").onclick=()=>{
  if(!output.value) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(output.value));
};

let recognition;
$("mic").onclick=()=>{
  if(!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)){
    alert("Voice input is not supported in this browser.");
    return;
  }
  const R=window.SpeechRecognition||window.webkitSpeechRecognition;
  recognition=new R();
  recognition.continuous=false;
  recognition.interimResults=true;
  recognition.lang=source.value==="auto"?"en-IN":source.value;
  recognition.onstart=()=>setStatus("Listening\u2026");
  recognition.onresult=e=>{
    let s="";
    for(let i=e.resultIndex;i<e.results.length;i++) s+=e.results[i][0].transcript;
    input.value=s; updateCount(); schedule();
  };
  recognition.onerror=()=>setStatus("Voice error");
  recognition.onend=()=>{setStatus("Ready");translate()};
  recognition.start();
};

updateCount();
