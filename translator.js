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
    // Public demo endpoint. No secret/API key is stored in this GitHub version.
    const body={
      q:text,
      source:source.value==="auto"?"auto":source.value,
      target:target.value,
      format:"text"
    };
    const r=await fetch("https://libretranslate.com/translate",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    if(!r.ok) throw new Error("Provider unavailable");
    const d=await r.json();

    if(myId!==requestId) return; // a newer request has superseded this one

    output.value=d.translatedText||"";
    setStatus("Translated");
    if(source.value==="auto" && d.detectedLanguage && d.detectedLanguage.language){
      detected.textContent=`Detected: ${langName(d.detectedLanguage.language)}`;
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
