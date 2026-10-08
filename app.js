const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const audio = document.getElementById("audio");
const imageInput = document.getElementById("imageInput");
const audioInput = document.getElementById("audioInput");
const playButton = document.getElementById("playButton");
const exportButton = document.getElementById("exportButton");
const exportStatus = document.getElementById("exportStatus");
const titleInput = document.getElementById("titleInput");
const artistInput = document.getElementById("artistInput");
const subtitleInput = document.getElementById("subtitleInput");
const fontInput = document.getElementById("fontInput");
const speedInput = document.getElementById("speedInput");
const waveInput = document.getElementById("waveInput");
const autoColorInput = document.getElementById("autoColorInput");
const resolutionInput = document.getElementById("resolutionInput");

let cover = null;
let accent = "#d6bd1c";
let bgColor = "#d9d8cc";
let textColor = "#1f1f1b";
let mutedColor = "#66645b";
let audioURL = null;
let imageURL = null;
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let freqData = null;
let isExporting = false;
let raf = 0;
let lastFrame = performance.now();
let vinylAngle = 0;
let lastAudioTime = 0;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r,g,b) {
  return "#" + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
}
function luminance(r,g,b) { return .2126*r + .7152*g + .0722*b; }
function clamp(v,a,b) { return Math.max(a,Math.min(b,v)); }

function extractColors(img) {
  const c = document.createElement("canvas");
  const w = 120, h = 120;
  c.width=w; c.height=h;
  const x=c.getContext("2d");
  x.drawImage(img,0,0,w,h);
  const data=x.getImageData(0,0,w,h).data;
  let sr=0,sg=0,sb=0,count=0;
  const buckets=new Map();
  for(let i=0;i<data.length;i+=16){
    const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
    if(a<180) continue;
    sr+=r;sg+=g;sb+=b;count++;
    const q=[Math.round(r/24)*24,Math.round(g/24)*24,Math.round(b/24)*24];
    const key=q.join(","); buckets.set(key,(buckets.get(key)||0)+1);
  }
  let best=[210,190,40],bestScore=-1;
  for(const [key,n] of buckets){
    const [r,g,b]=key.split(",").map(Number);
    const sat=Math.max(r,g,b)-Math.min(r,g,b);
    const lum=luminance(r,g,b);
    const score=n*(1+sat/180)*(1-Math.abs(lum-145)/330);
    if(score>bestScore){bestScore=score;best=[r,g,b];}
  }
  const avgLum=count ? luminance(sr/count,sg/count,sb/count) : 128;
  accent=rgbToHex(...best);
  bgColor=rgbToHex((sr/count)||128,(sg/count)||128,(sb/count)||128);

  // Text follows the image/background brightness automatically.
  if(avgLum < 145){
    textColor="#f5f5f0";
    mutedColor="#d2d1c8";
  } else {
    textColor="#20201c";
    mutedColor="#5e5c54";
  }
  document.documentElement.style.setProperty("--accent",accent);
}

function formatTime(seconds){
  if(!Number.isFinite(seconds)) return "00:00";
  const s=Math.floor(seconds),m=Math.floor(s/60);
  return `${String(m).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

function setupAudioGraph(){
  if(audioCtx) return;
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  analyser=audioCtx.createAnalyser();
  analyser.fftSize=512;
  analyser.smoothingTimeConstant=.72;
  freqData=new Uint8Array(analyser.frequencyBinCount);
  sourceNode=audioCtx.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function drawBackground(W,H){
  if(!cover){
    ctx.fillStyle="#080d17"; ctx.fillRect(0,0,W,H); return;
  }
  ctx.save();
  ctx.filter=`blur(${Math.max(18,Math.round(W*.018))}px)`;
  const iw=cover.naturalWidth||cover.width, ih=cover.naturalHeight||cover.height;
  const scale=Math.max(W/iw,H/ih)*1.12;
  const dw=iw*scale,dh=ih*scale;
  ctx.globalAlpha=.62;
  ctx.drawImage(cover,(W-dw)/2,(H-dh)/2,dw,dh);
  ctx.restore();

  const rgb=hexToRgb(bgColor);
  const avg=luminance(rgb.r,rgb.g,rgb.b);
  ctx.fillStyle=avg<145 ? "rgba(0,0,0,.34)" : "rgba(255,255,245,.32)";
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle="rgba(255,255,255,.045)";
  ctx.fillRect(0,0,W,H);
}

function drawVinyl(cx,cy,radius,angle){
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(angle);
  ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fillStyle="#080a0f";ctx.fill();
  for(let r=radius-4;r>radius*.25;r-=7){
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,255,255,${.025+(radius-r)/radius*.012})`;ctx.lineWidth=1;ctx.stroke();
  }
  ctx.beginPath();ctx.arc(0,0,radius*.28,0,Math.PI*2);ctx.fillStyle="#11151e";ctx.fill();
  if(cover){
    ctx.save();ctx.beginPath();ctx.arc(0,0,radius*.255,0,Math.PI*2);ctx.clip();
    ctx.drawImage(cover,-radius*.255,-radius*.255,radius*.51,radius*.51);ctx.restore();
  }
  ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fillStyle="#cfd5e2";ctx.fill();
  ctx.restore();
}

function drawCover(x,y,w,h){
  if(!cover)return;
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,34);ctx.clip();ctx.drawImage(cover,x,y,w,h);ctx.restore();
}

function drawWave(x,y,w,h){
  const bars=96,gap=5,bw=Math.max(2,(w-gap*(bars-1))/bars);
  let level=.06;
  if(analyser&&freqData){
    analyser.getByteFrequencyData(freqData);
    let sum=0;
    for(let i=0;i<freqData.length;i++) sum+=freqData[i];
    level=sum/(freqData.length*255);
  }
  const rgb=hexToRgb(accent);
  for(let i=0;i<bars;i++){
    let v=.08;
    if(analyser&&freqData){
      const idx=Math.floor((i/bars)*freqData.length*.55);
      v=(freqData[Math.min(freqData.length-1,idx)]||0)/255;
    } else {
      v=.08+Math.abs(Math.sin(i*.32+audio.currentTime*2))*.12;
    }
    const motion=audio.paused ? .55 : 1;
    const bh=Math.max(3,(v*.78+.05*level)*h*Number(waveInput.value)*motion);
    const xx=x+i*(bw+gap);
    ctx.fillStyle=`rgba(${rgb.r},${rgb.g},${rgb.b},${.42+v*.55})`;
    ctx.fillRect(xx,y+h/2-bh/2,bw,bh);
  }
}

function drawHUD(W,H){
  const a=hexToRgb(accent);
  ctx.strokeStyle="rgba(180,195,230,.32)";ctx.lineWidth=1;ctx.strokeRect(44,44,W-88,H-88);
  ctx.strokeStyle=`rgba(${a.r},${a.g},${a.b},.92)`;ctx.lineWidth=4;
  const corners=[[44,44,100,44,44,100],[W-44,44,W-100,44,W-44,100],[44,H-44,100,H-44,44,H-100],[W-44,H-44,W-100,H-44,W-44,H-100]];
  for(const [x1,y1,x2,y2,x3,y3] of corners){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.moveTo(x1,y1);ctx.lineTo(x3,y3);ctx.stroke();}
  ctx.font=`600 20px ${fontInput.value}`;ctx.fillStyle=textColor;ctx.fillText("•  NOW PLAYING",70,82);
  ctx.font=`500 17px ${fontInput.value}`;ctx.textAlign="right";ctx.fillStyle=textColor;ctx.fillText(formatTime(audio.currentTime),W-70,82);ctx.textAlign="left";
}

function render(){
  const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  drawBackground(W,H);
  drawHUD(W,H);

  const coverSize=Math.min(H*.56,W*.36);
  const coverX=W*.08,coverY=(H-coverSize)/2+20;
  const vinylRadius=coverSize*.50;
  const vinylX=coverX+coverSize+coverSize*.18;
  const vinylY=coverY+coverSize*.50;

  // LP is deliberately drawn first so the album image sits above it.
  drawVinyl(vinylX,vinylY,vinylRadius,vinylAngle);
  drawCover(coverX,coverY,coverSize,coverSize);

  const tx=W*.56;
  ctx.font=`600 ${Math.max(42,W*.035)}px ${fontInput.value}`;ctx.fillStyle=textColor;ctx.fillText(titleInput.value||" ",tx,H*.39);
  ctx.font=`500 24px ${fontInput.value}`;ctx.fillStyle=accent;ctx.fillText(artistInput.value||" ",tx,H*.46);
  ctx.font=`400 18px ${fontInput.value}`;ctx.fillStyle=mutedColor;ctx.fillText(subtitleInput.value||" ",tx,H*.515);
  drawWave(tx,H*.61,W*.35,70);

  const barY=H*.76;
  ctx.fillStyle=`rgba(${hexToRgb(textColor).r},${hexToRgb(textColor).g},${hexToRgb(textColor).b},.18)`;
  ctx.fillRect(tx,barY,W*.35,5);
  const progress=audio.duration ? audio.currentTime/audio.duration : 0;
  ctx.fillStyle=accent;ctx.fillRect(tx,barY,W*.35*clamp(progress,0,1),5);
  ctx.font=`400 18px ${fontInput.value}`;ctx.fillStyle=mutedColor;ctx.fillText(formatTime(audio.currentTime),tx,barY+38);
  ctx.textAlign="right";ctx.fillText(formatTime(audio.duration),tx+W*.35,barY+38);ctx.textAlign="left";

  const now=performance.now(),dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;
  if(!audio.paused){
    const delta=Math.max(0,audio.currentTime-lastAudioTime);
    vinylAngle += delta*Number(speedInput.value)*Math.PI/2;
  }
  lastAudioTime=audio.currentTime;
  raf=requestAnimationFrame(render);
}

function resizeCanvas(){const [w,h]=resolutionInput.value.split("x").map(Number);canvas.width=w;canvas.height=h;}
resolutionInput.addEventListener("change",resizeCanvas);

imageInput.addEventListener("change",e=>{
  const file=e.target.files[0];if(!file)return;
  if(imageURL)URL.revokeObjectURL(imageURL);
  imageURL=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{cover=img;if(autoColorInput.checked)extractColors(img);exportStatus.textContent=audio.src?"미리보기 준비됨":"음악과 이미지를 넣어줘";};
  img.src=imageURL;
});

audioInput.addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  if(audioURL)URL.revokeObjectURL(audioURL);
  audioURL=URL.createObjectURL(file);audio.src=audioURL;audio.load();
  try{setupAudioGraph();}catch(err){console.warn(err);}
  playButton.disabled=false;exportButton.disabled=!cover;
  exportStatus.textContent=`음악 준비됨 · ${file.name}`;
  const title=file.name.replace(/\.[^/.]+$/,'');
  if(!titleInput.value||titleInput.value==="NOW PLAYING")titleInput.value=title;
});

playButton.addEventListener("click",async()=>{
  if(!audio.src)return;
  try{setupAudioGraph();if(audioCtx.state==="suspended")await audioCtx.resume();if(audio.paused){await audio.play();}else{audio.pause();}}catch(err){console.error(err);exportStatus.textContent="재생 오류: 브라우저의 오디오 재생 권한을 확인해줘";}
});

audio.addEventListener("play",()=>{playButton.textContent="일시정지";exportStatus.textContent="미리보기 재생 중";lastAudioTime=audio.currentTime;});
audio.addEventListener("pause",()=>{if(!audio.ended)playButton.textContent="재생";});
audio.addEventListener("ended",()=>{playButton.textContent="재생";if(!isExporting)exportStatus.textContent="재생 완료";});

autoColorInput.addEventListener("change",()=>{if(autoColorInput.checked&&cover)extractColors(cover);});

[titleInput,artistInput,subtitleInput,fontInput,speedInput,waveInput].forEach(el=>el.addEventListener("input",()=>{}));

async function exportVideo(){
  if(!audio.src||!cover)return;
  if(!window.MediaRecorder){alert("이 브라우저는 영상 녹화를 지원하지 않아. 최신 Chrome 또는 Edge를 사용해줘.");return;}
  isExporting=true;exportButton.disabled=true;playButton.disabled=true;exportStatus.textContent="영상 렌더링 준비 중…";
  const oldTime=audio.currentTime,oldPaused=audio.paused;
  const stream=canvas.captureStream(60);
  try{
    setupAudioGraph();
    const dest=audioCtx.createMediaStreamDestination();sourceNode.connect(dest);
    const combined=new MediaStream([...stream.getVideoTracks(),...dest.stream.getAudioTracks()]);
    const mimeTypes=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];
    const mime=mimeTypes.find(x=>MediaRecorder.isTypeSupported(x));if(!mime)throw new Error("지원되는 WebM 포맷이 없어");
    const chunks=[];const recorder=new MediaRecorder(combined,{mimeType:mime,videoBitsPerSecond:12000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    const stopped=new Promise(resolve=>recorder.onstop=resolve);
    audio.currentTime=0;vinylAngle=0;recorder.start(250);await audio.play();
    await new Promise(resolve=>{const timer=setInterval(()=>{exportStatus.textContent=`영상 렌더링 중… ${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;if(audio.ended){clearInterval(timer);resolve();}},250);});
    recorder.stop();await stopped;
    const blob=new Blob(chunks,{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;const safe=(titleInput.value||"music-visualizer").replace(/[\\/:*?"<>|]/g,"_");a.download=`${safe}.webm`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    exportStatus.textContent="완료 · 영상이 다운로드됐어";
  }catch(err){
    console.error(err);exportStatus.textContent=`오류: ${err.message}`;alert("영상 추출 중 문제가 생겼어. 최신 Chrome/Edge에서 다시 시도해줘.");audio.currentTime=oldTime;vinylAngle=0;if(!oldPaused)audio.play();
  }finally{isExporting=false;exportButton.disabled=false;playButton.disabled=false;}
}
exportButton.addEventListener("click",exportVideo);
resizeCanvas();render();
