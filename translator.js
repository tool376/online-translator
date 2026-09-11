const languages=[
["auto","Auto Detect"],["en","English"],["hi","Hindi"],["bn","Bengali"],["ta","Tamil"],["te","Telugu"],["mr","Marathi"],["gu","Gujarati"],["kn","Kannada"],["ml","Malayalam"],["pa","Punjabi"],["ur","Urdu"],["ne","Nepali"],["si","Sinhala"],["ar","Arabic"],["fa","Persian"],["he","Hebrew"],["fr","French"],["de","German"],["es","Spanish"],["it","Italian"],["pt","Portuguese"],["ru","Russian"],["uk","Ukrainian"],["pl","Polish"],["nl","Dutch"],["tr","Turkish"],["el","Greek"],["sv","Swedish"],["da","Danish"],["no","Norwegian"],["fi","Finnish"],["cs","Czech"],["ro","Romanian"],["hu","Hungarian"],["id","Indonesian"],["ms","Malay"],["th","Thai"],["vi","Vietnamese"],["ja","Japanese"],["ko","Korean"],["zh","Chinese"],["sw","Swahili"],["af","Afrikaans"],["fil","Filipino"],["fa","Persian"],["am","Amharic"],["az","Azerbaijani"],["ka","Georgian"],["kk","Kazakh"],["uz","Uzbek"]
];
const $=id=>document.getElementById(id), source=$("source"), target=$("target"), input=$("input"), output=$("output"), status=$("status");
languages.forEach(([v,n])=>{source.add(new Option(n,v));target.add(new Option(n,v))});
source.value="auto";target.value="hi";

let timer=null, lastText="";
function setStatus(t){status.textContent=t}
async function translate(){
  const text=input.value.trim(); if(!text){output.value="";setStatus("Ready");return}
  if(text===lastText)return; lastText=text; setStatus("Translating…");
  try{
    // Public demo endpoint. No secret/API key is stored in this GitHub version.
    const body={q:text,source:source.value==="auto"?"auto":source.value,target:target.value,format:"text"};
    const r=await fetch("https://libretranslate.com/translate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    if(!r.ok)throw new Error("Provider unavailable");
    const d=await r.json(); output.value=d.translatedText||"";
    setStatus("Translated");
  }catch(e){
    output.value="Demo translation service is unavailable right now. Connect the secure Gemini backend for production use.";
    setStatus("Service unavailable");
  }
}
function schedule(){clearTimeout(timer);if(!$("realtime").checked)return;timer=setTimeout(translate,650)}
input.addEventListener("input",()=>{$("count").textContent=`${input.value.length} / 5000`;schedule()});
$("realtime").addEventListener("change",()=>{if($("realtime").checked)schedule()});
source.addEventListener("change",translate);target.addEventListener("change",translate);
$("swap").onclick=()=>{if(source.value==="auto")return;[source.value,target.value]=[target.value,source.value];[input.value,output.value]=[output.value,input.value];lastText="";$("count").textContent=`${input.value.length} / 5000`};
$("clear").onclick=()=>{input.value="";output.value="";lastText="";$("count").textContent="0 / 5000";setStatus("Ready")};
$("copy").onclick=async()=>{if(output.value){await navigator.clipboard.writeText(output.value);setStatus("Copied")}};
$("download").onclick=()=>{const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([output.value],{type:"text/plain;charset=utf-8"}));a.download="translation.txt";a.click();URL.revokeObjectURL(a.href)};
$("speak").onclick=()=>{if(output.value)speechSynthesis.speak(new SpeechSynthesisUtterance(output.value))};

let recognition;
$("mic").onclick=()=>{
 if(!("webkitSpeechRecognition" in window||"SpeechRecognition" in window)){alert("Voice input is not supported in this browser.");return}
 const R=window.SpeechRecognition||window.webkitSpeechRecognition; recognition=new R();
 recognition.continuous=false;recognition.interimResults=true;recognition.lang=source.value==="auto"?"en-IN":source.value;
 recognition.onstart=()=>setStatus("Listening…");
 recognition.onresult=e=>{let s="";for(let i=e.resultIndex;i<e.results.length;i++)s+=e.results[i][0].transcript;input.value=s;$("count").textContent=`${s.length} / 5000`;schedule()};
 recognition.onerror=()=>setStatus("Voice error");recognition.onend=()=>{setStatus("Ready");translate()};recognition.start();
};