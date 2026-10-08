const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const audio = document.getElementById("audio");
const imageInput = document.getElementById("imageInput");
const audioInput = document.getElementById("audioInput");
const exportButton = document.getElementById("exportButton");
const exportStatus = document.getElementById("exportStatus");
const emptyState = document.getElementById("emptyState");

const titleInput = document.getElementById("titleInput");
const artistInput = document.getElementById("artistInput");
const subtitleInput = document.getElementById("subtitleInput");
const fontInput = document.getElementById("fontInput");
const speedInput = document.getElementById("speedInput");
const waveInput = document.getElementById("waveInput");
const autoColorInput = document.getElementById("autoColorInput");
const resolutionInput = document.getElementById("resolutionInput");

let cover = null;
let accent = "#8da5ff";
let bgColor = "#090f1c";
let audioURL = null;
let imageURL = null;
let raf = 0;
let startedAt = performance.now();
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let freqData = null;
let isExporting = false;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return "#" + [r,g,b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,"0")).join("");
}

function luminance(r,g,b) {
  return .2126*r + .7152*g + .0722*b;
}

function extractColors(img) {
  const c = document.createElement("canvas");
  const w = 80, h = 80;
  c.width = w; c.height = h;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, w, h);
  const data = x.getImageData(0,0,w,h).data;
  const buckets = new Map();

  for (let i=0; i<data.length; i+=16) {
    const r=data[i], g=data[i+1], b=data[i+2], a=data[i+3];
    if (a < 180) continue;
    const q = [Math.round(r/24)*24, Math.round(g/24)*24, Math.round(b/24)*24];
    const key = q.join(",");
    buckets.set(key, (buckets.get(key)||0)+1);
  }

  let best = [120,145,220], bestScore = -1;
  for (const [key,count] of buckets) {
    const [r,g,b] = key.split(",").map(Number);
    const sat = Math.max(r,g,b)-Math.min(r,g,b);
    const lum = luminance(r,g,b);
    const score = count * (1 + sat/160) * (1 - Math.abs(lum-145)/300);
    if (score > bestScore) { bestScore=score; best=[r,g,b]; }
  }

  accent = rgbToHex(...best);
  const dark = best.map(v => Math.round(v * .075 + 5));
  bgColor = rgbToHex(...dark);
  document.documentElement.style.setProperty("--accent", accent);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const s = Math.floor(seconds);
  const m = Math.floor(s/60);
  return `${String(m).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

function setupAudioGraph() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = .78;
  freqData = new Uint8Array(analyser.frequencyBinCount);
  sourceNode = audioCtx.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function roundedRectPath(x,y,w,h,r) {
  const p = new Path2D();
  p.moveTo(x+r,y); p.lineTo(x+w-r,y);
  p.quadraticCurveTo(x+w,y,x+w,y+r);
  p.lineTo(x+w,y+h-r); p.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  p.lineTo(x+r,y+h); p.quadraticCurveTo(x,y+h,x,y+h-r);
  p.lineTo(x,y+r); p.quadraticCurveTo(x,y,x+r,y);
  return p;
}

function drawCover(x,y,w,h) {
  if (!cover) return;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,34);
  ctx.clip();
  ctx.drawImage(cover,x,y,w,h);
  ctx.restore();
}

function drawVinyl(cx, cy, radius, angle) {
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(angle);

  ctx.beginPath();
  ctx.arc(0,0,radius,0,Math.PI*2);
  ctx.fillStyle = "#080a0f";
  ctx.fill();

  for (let r=radius-4; r>radius*.25; r-=7) {
    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.strokeStyle = `rgba(255,255,255,${.025 + (radius-r)/radius*.012})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(0,0,radius*.28,0,Math.PI*2);
  ctx.fillStyle = "#11151e";
  ctx.fill();

  if (cover) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0,0,radius*.255,0,Math.PI*2);
    ctx.clip();
    ctx.drawImage(cover,-radius*.255,-radius*.255,radius*.51,radius*.51);
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(0,0,6,0,Math.PI*2);
  ctx.fillStyle = "#cfd5e2";
  ctx.fill();

  ctx.restore();
}

function drawWave(x,y,w,h) {
  if (!analyser || !freqData) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for(let i=0;i<80;i++){
      const xx=x+(i/79)*w;
      const yy=y+h/2+Math.sin(i*.45)*h*.12;
      i ? ctx.lineTo(xx,yy) : ctx.moveTo(xx,yy);
    }
    ctx.stroke();
    return;
  }

  analyser.getByteFrequencyData(freqData);
  const bars = 90;
  const gap = 7;
  const bw = Math.max(2,(w-gap*(bars-1))/bars);
  const rgb = hexToRgb(accent);

  for(let i=0;i<bars;i++){
    const idx = Math.floor(i/freqData.length*bars*freqData.length/2);
    const v = (freqData[Math.min(freqData.length-1,idx)]||0)/255;
    const bh = Math.max(4, v*h*.72*Number(waveInput.value));
    const xx=x+i*(bw+gap);
    ctx.fillStyle=`rgba(${rgb.r},${rgb.g},${rgb.b},${.35+v*.65})`;
    ctx.fillRect(xx,y+h/2-bh/2,bw,bh);
  }
}

function render() {
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);

  // Background
  ctx.fillStyle=bgColor;
  ctx.fillRect(0,0,W,H);
  const grad=ctx.createRadialGradient(W*.32,H*.42,0,W*.32,H*.42,W*.55);
  const a=hexToRgb(accent);
  grad.addColorStop(0,`rgba(${a.r},${a.g},${a.b},.13)`);
  grad.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);

  // HUD frame
  ctx.strokeStyle="rgba(180,195,230,.18)";
  ctx.lineWidth=1;
  ctx.strokeRect(44,44,W-88,H-88);
  ctx.strokeStyle=`rgba(${a.r},${a.g},${a.b},.9)`;
  ctx.lineWidth=4;
  const corners=[[44,44,100,44,44,100],[W-44,44,W-100,44,W-44,100],[44,H-44,100,H-44,44,H-100],[W-44,H-44,W-100,H-44,W-44,H-100]];
  for(const [x1,y1,x2,y2,x3,y3] of corners){
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.moveTo(x1,y1);ctx.lineTo(x3,y3);ctx.stroke();
  }

  ctx.font=`600 20px ${fontInput.value}`;
  ctx.fillStyle="#dbe2f1";
  ctx.fillText("•  NOW PLAYING",70,82);

  ctx.font=`500 17px ${fontInput.value}`;
  ctx.fillStyle=accent;
  ctx.textAlign="right";
  ctx.fillText(formatTime(audio.currentTime),W-70,82);
  ctx.textAlign="left";

  const coverSize=Math.min(H*.56,W*.36);
  const coverX=W*.08, coverY=(H-coverSize)/2+20;
  drawCover(coverX,coverY,coverSize,coverSize);

  const elapsed=audio.currentTime||0;
  drawVinyl(coverX+coverSize+coverSize*.18,coverY+coverSize*.50,coverSize*.50,elapsed*Number(speedInput.value)*Math.PI/2);

  const tx=W*.56;
  ctx.font=`600 ${Math.max(42,W*.035)}px ${fontInput.value}`;
  ctx.fillStyle="#eef2f9";
  ctx.fillText(titleInput.value || " ",tx,H*.39);

  ctx.font=`500 24px ${fontInput.value}`;
  ctx.fillStyle=accent;
  ctx.fillText(artistInput.value || " ",tx,H*.46);

  ctx.font=`400 18px ${fontInput.value}`;
  ctx.fillStyle="#9ba5ba";
  ctx.fillText(subtitleInput.value || " ",tx,H*.515);

  drawWave(tx,H*.61,W*.35,70);

  const barY=H*.76;
  ctx.fillStyle="rgba(160,175,210,.2)";
  ctx.fillRect(tx,barY,W*.35,5);
  const progress=audio.duration ? audio.currentTime/audio.duration : 0;
  ctx.fillStyle=accent;
  ctx.fillRect(tx,barY,W*.35*progress,5);

  ctx.font=`400 18px ${fontInput.value}`;
  ctx.fillStyle="#9aa5bb";
  ctx.fillText(formatTime(audio.currentTime),tx,barY+38);
  ctx.textAlign="right";
  ctx.fillText(formatTime(audio.duration),tx+W*.35,barY+38);
  ctx.textAlign="left";

  ctx.font=`400 14px ${fontInput.value}`;
  ctx.fillStyle="#7c879d";
  ctx.fillText("60FPS",70,H-70);
  ctx.textAlign="right";
  ctx.fillText("002%",W-70,H-70);
  ctx.textAlign="left";

  raf=requestAnimationFrame(render);
}

function resizeCanvas() {
  const [w,h]=resolutionInput.value.split("x").map(Number);
  canvas.width=w; canvas.height=h;
}
resolutionInput.addEventListener("change",()=>{resizeCanvas();});

imageInput.addEventListener("change", e=>{
  const file=e.target.files[0];
  if(!file)return;
  if(imageURL)URL.revokeObjectURL(imageURL);
  imageURL=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    cover=img;
    if(autoColorInput.checked)extractColors(img);
    emptyState.style.display="none";
  };
  img.src=imageURL;
});

audioInput.addEventListener("change", async e=>{
  const file=e.target.files[0];
  if(!file)return;
  if(audioURL)URL.revokeObjectURL(audioURL);
  audioURL=URL.createObjectURL(file);
  audio.src=audioURL;
  audio.load();
  try { setupAudioGraph(); } catch(err) { console.warn(err); }
  exportButton.disabled=false;
  exportStatus.textContent=`음악 준비됨 · ${file.name}`;
  const title=file.name.replace(/\.[^/.]+$/,"");
  if(!titleInput.value || titleInput.value==="NOW PLAYING") titleInput.value=title;
});

[audioInput,titleInput,artistInput,subtitleInput,fontInput,speedInput,waveInput].forEach(el=>{
  el.addEventListener("input",()=>{});
});

audio.addEventListener("play", async()=>{
  if(audioCtx && audioCtx.state==="suspended") await audioCtx.resume();
});
audio.addEventListener("ended",()=>{ if(!isExporting) exportStatus.textContent="재생 완료"; });

async function exportVideo() {
  if(!audio.src || !cover) return;
  if(!window.MediaRecorder) {
    alert("이 브라우저는 영상 녹화를 지원하지 않아. 최신 Chrome 또는 Edge를 사용해줘.");
    return;
  }

  isExporting=true;
  exportButton.disabled=true;
  exportStatus.textContent="영상 렌더링 준비 중…";

  const oldTime=audio.currentTime;
  const oldPaused=audio.paused;

  const stream=canvas.captureStream(60);
  let audioStream=null;

  try {
    setupAudioGraph();
    const dest=audioCtx.createMediaStreamDestination();
    sourceNode.connect(dest);
    audioStream=dest.stream;

    const combined=new MediaStream([
      ...stream.getVideoTracks(),
      ...audioStream.getAudioTracks()
    ]);

    const mimeTypes=[
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];
    const mime=mimeTypes.find(x=>MediaRecorder.isTypeSupported(x));
    if(!mime) throw new Error("지원되는 WebM 포맷이 없어");

    const chunks=[];
    const recorder=new MediaRecorder(combined,{mimeType:mime,videoBitsPerSecond:12000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};

    const stopped=new Promise(resolve=>recorder.onstop=resolve);
    audio.currentTime=0;
    recorder.start(250);
    await audio.play();

    await new Promise(resolve=>{
      const timer=setInterval(()=>{
        exportStatus.textContent=`영상 렌더링 중… ${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        if(audio.ended){
          clearInterval(timer);
          resolve();
        }
      },250);
    });

    recorder.stop();
    await stopped;

    const blob=new Blob(chunks,{type:mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    const safe=(titleInput.value||"music-visualizer").replace(/[\\/:*?"<>|]/g,"_");
    a.download=`${safe}.webm`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);

    exportStatus.textContent="완료 · 영상이 다운로드됐어";
  } catch(err) {
    console.error(err);
    exportStatus.textContent=`오류: ${err.message}`;
    alert("영상 추출 중 문제가 생겼어. 최신 Chrome/Edge에서 다시 시도해줘.");
    audio.currentTime=oldTime;
    if(!oldPaused) audio.play();
  } finally {
    isExporting=false;
    exportButton.disabled=false;
  }
}

exportButton.addEventListener("click",exportVideo);

resizeCanvas();
render();
