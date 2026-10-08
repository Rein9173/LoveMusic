const canvas=document.getElementById("canvas"),ctx=canvas.getContext("2d");
const audio=document.getElementById("audio");
const imageInput=document.getElementById("imageInput"),audioInput=document.getElementById("audioInput");
const playButton=document.getElementById("playButton"),previewPlayButton=document.getElementById("previewPlayButton"),exportButton=document.getElementById("exportButton"),exportStatus=document.getElementById("exportStatus");
const titleInput=document.getElementById("titleInput"),artistInput=document.getElementById("artistInput"),subtitleInput=document.getElementById("subtitleInput"),fontInput=document.getElementById("fontInput");
const titleSizeInput=document.getElementById("titleSizeInput"),artistSizeInput=document.getElementById("artistSizeInput"),subtitleSizeInput=document.getElementById("subtitleSizeInput");
const titleSizeValue=document.getElementById("titleSizeValue"),artistSizeValue=document.getElementById("artistSizeValue"),subtitleSizeValue=document.getElementById("subtitleSizeValue");
const speedInput=document.getElementById("speedInput"),waveInput=document.getElementById("waveInput"),autoColorInput=document.getElementById("autoColorInput"),resolutionInput=document.getElementById("resolutionInput"),formatInput=document.getElementById("formatInput");
const seekInput=document.getElementById("seekInput"),volumeInput=document.getElementById("volumeInput"),currentTimeLabel=document.getElementById("currentTimeLabel"),durationLabel=document.getElementById("durationLabel");
let cover=null,accent="#d6bd1c",bgColor="#d9d8cc",textColor="#1f1f1b",mutedColor="#66645b",audioURL=null,imageURL=null;
let audioCtx=null,analyser=null,sourceNode=null,freqData=null,isExporting=false,vinylAngle=0,lastAudioTime=0,seeking=false;

function hexToRgb(hex){const n=parseInt(hex.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
function rgbToHex(r,g,b){return"#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("")}
function luminance(r,g,b){return .2126*r+.7152*g+.0722*b}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function formatTime(seconds){if(!Number.isFinite(seconds))return"00:00";const s=Math.max(0,Math.floor(seconds)),m=Math.floor(s/60);return`${String(m).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function fontFamily(){const f=fontInput.value;return f.includes(" ")?`"${f}"`:f}
function cssColor(r,g,b,a=1){return`rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`}

function extractColors(img){
  const c=document.createElement("canvas");c.width=120;c.height=120;const x=c.getContext("2d");x.drawImage(img,0,0,120,120);const data=x.getImageData(0,0,120,120).data;
  let sr=0,sg=0,sb=0,count=0;const buckets=new Map();
  for(let i=0;i<data.length;i+=16){const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];if(a<180)continue;sr+=r;sg+=g;sb+=b;count++;const q=[Math.round(r/24)*24,Math.round(g/24)*24,Math.round(b/24)*24],key=q.join(",");buckets.set(key,(buckets.get(key)||0)+1)}
  let best=[210,190,40],bestScore=-1;
  for(const[key,n]of buckets){const[r,g,b]=key.split(",").map(Number),sat=Math.max(r,g,b)-Math.min(r,g,b),lum=luminance(r,g,b),score=n*(1+sat/180)*(1-Math.abs(lum-145)/330);if(score>bestScore){bestScore=score;best=[r,g,b]}}
  const avgR=count?sr/count:128,avgG=count?sg/count:128,avgB=count?sb/count:128;accent=rgbToHex(...best);bgColor=rgbToHex(avgR,avgG,avgB);
  applyTextContrast(luminance(avgR,avgG,avgB));
  document.documentElement.style.setProperty("--accent",accent);
}
function applyTextContrast(backgroundLum){
  if(backgroundLum<145){textColor="#f5f5f0";mutedColor="#d2d1c8"}else{textColor="#20201c";mutedColor="#5e5c54"}
}
function getScale(){return canvas.height/1080}
function currentFontSize(input){return Number(input.value)*getScale()}
function updateSizeLabels(){titleSizeValue.value=titleSizeInput.value;artistSizeValue.value=artistSizeInput.value;subtitleSizeValue.value=subtitleSizeInput.value}

function setupAudioGraph(){
  if(audioCtx)return;
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();analyser=audioCtx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.72;freqData=new Uint8Array(analyser.frequencyBinCount);
  sourceNode=audioCtx.createMediaElementSource(audio);sourceNode.connect(analyser);analyser.connect(audioCtx.destination);
}
function drawBackground(W,H){
  if(!cover){ctx.fillStyle="#080d17";ctx.fillRect(0,0,W,H);return}
  const iw=cover.naturalWidth||cover.width,ih=cover.naturalHeight||cover.height,scale=Math.max(W/iw,H/ih)*1.16,dw=iw*scale,dh=ih*scale;
  ctx.save();ctx.filter=`blur(${Math.max(20,Math.round(W*.022))}px)`;ctx.globalAlpha=.72;ctx.drawImage(cover,(W-dw)/2,(H-dh)/2,dw,dh);ctx.restore();
  const rgb=hexToRgb(bgColor),avg=luminance(rgb.r,rgb.g,rgb.b);applyTextContrast(avg);
  ctx.fillStyle=avg<145?"rgba(0,0,0,.44)":"rgba(255,255,245,.44)";ctx.fillRect(0,0,W,H);
  ctx.fillStyle=avg<145?"rgba(0,0,0,.10)":"rgba(255,255,255,.08)";ctx.fillRect(0,0,W,H);
  const grad=ctx.createLinearGradient(0,0,W,H);grad.addColorStop(0,cssColor(rgb.r,rgb.g,rgb.b,.10));grad.addColorStop(.55,"rgba(255,255,255,0)");grad.addColorStop(1,cssColor(rgb.r,rgb.g,rgb.b,.16));ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
}
function drawVinyl(cx,cy,radius,angle){
  ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.shadowColor="rgba(0,0,0,.25)";ctx.shadowBlur=22;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fillStyle="#080a0f";ctx.fill();ctx.shadowBlur=0;
  for(let r=radius-4;r>radius*.25;r-=7){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.strokeStyle="rgba(255,255,255,.035)";ctx.lineWidth=1;ctx.stroke()}
  ctx.beginPath();ctx.arc(0,0,radius*.28,0,Math.PI*2);ctx.fillStyle="#11151e";ctx.fill();
  if(cover){ctx.save();ctx.beginPath();ctx.arc(0,0,radius*.255,0,Math.PI*2);ctx.clip();drawImageContain(cover,-radius*.255,-radius*.255,radius*.51,radius*.51,0);ctx.restore()}
  ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fillStyle="#cfd5e2";ctx.fill();ctx.restore();
}
function drawImageContain(img,x,y,w,h,pad=0){
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;if(!iw||!ih)return;
  const boxW=Math.max(1,w-pad*2),boxH=Math.max(1,h-pad*2),scale=Math.min(boxW/iw,boxH/ih),dw=iw*scale,dh=ih*scale;
  ctx.drawImage(img,x+pad+(boxW-dw)/2,y+pad+(boxH-dh)/2,dw,dh);
}
function drawCover(x,y,w,h){
  if(!cover)return;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,Math.min(34,w*.055));ctx.clip();
  const rgb=hexToRgb(bgColor);ctx.fillStyle=cssColor(rgb.r,rgb.g,rgb.b,.28);ctx.fillRect(x,y,w,h);drawImageContain(cover,x,y,w,h,0);ctx.restore();
}
function drawWave(x,y,w,h){
  const bars=96,gap=5,bw=Math.max(2,(w-gap*(bars-1))/bars);let level=.06;
  if(analyser&&freqData){analyser.getByteFrequencyData(freqData);let sum=0;for(let i=0;i<freqData.length;i++)sum+=freqData[i];level=sum/(freqData.length*255)}
  const rgb=hexToRgb(accent);
  for(let i=0;i<bars;i++){let v=.08;if(analyser&&freqData){const idx=Math.floor((i/bars)*freqData.length*.55);v=(freqData[Math.min(freqData.length-1,idx)]||0)/255}const motion=audio.paused?.45:1,bh=Math.max(3,(v*.78+.05*level)*h*Number(waveInput.value)*motion),xx=x+i*(bw+gap);ctx.fillStyle=`rgba(${rgb.r},${rgb.g},${rgb.b},${.42+v*.55})`;ctx.fillRect(xx,y+h/2-bh/2,bw,bh)}
}
function drawTextFit(text,x,y,maxWidth,fontSize,weight,color){
  if(!text)return;ctx.font=`${weight} ${fontSize}px ${fontFamily()}`;ctx.fillStyle=color;ctx.textAlign="left";
  if(ctx.measureText(text).width<=maxWidth){ctx.fillText(text,x,y);return}
  let out="";for(const ch of text){const test=out+ch;if(ctx.measureText(test+"…").width>maxWidth)break;out=test}ctx.fillText(out+"…",x,y);
}
function drawHUD(W,H){
  const s=getScale(),a=hexToRgb(accent);const inset=Math.max(28,Math.round(Math.min(W,H)*.041));
  ctx.strokeStyle="rgba(210,220,235,.35)";ctx.lineWidth=1;ctx.strokeRect(inset,inset,W-inset*2,H-inset*2);
  ctx.strokeStyle=`rgba(${a.r},${a.g},${a.b},.9)`;ctx.lineWidth=Math.max(2,4*s);
  const corner=Math.max(52,Math.min(W,H)*.055);const corners=[[inset,inset,inset+corner,inset,inset,inset+corner],[W-inset,inset,W-inset-corner,inset,W-inset,inset+corner],[inset,H-inset,inset+corner,H-inset,inset,H-inset-corner],[W-inset,H-inset,W-inset-corner,H-inset,W-inset,H-inset-corner]];
  for(const[x1,y1,x2,y2,x3,y3]of corners){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.moveTo(x1,y1);ctx.lineTo(x3,y3);ctx.stroke()}
  ctx.strokeStyle=`rgba(${a.r},${a.g},${a.b},.45)`;ctx.lineWidth=1;
  for(let x=W*.36;x<W*.64;x+=14*s){ctx.beginPath();ctx.moveTo(x,inset+4*s);ctx.lineTo(x,inset+12*s+(Math.round(x)%5)*s);ctx.stroke()}
  for(let y=H*.33;y<H*.68;y+=15*s){ctx.beginPath();ctx.moveTo(inset+4*s,y);ctx.lineTo(inset+12*s,y);ctx.stroke()}
  ctx.fillStyle=textColor;ctx.font=`500 ${Math.max(13,16*s)}px ${fontFamily()}`;ctx.textAlign="right";ctx.fillText(formatTime(audio.currentTime),W-inset-22*s,inset+Math.max(20,22*s));ctx.textAlign="left";
  ctx.fillStyle=mutedColor;ctx.font=`400 ${Math.max(11,14*s)}px "Space Mono",monospace`;ctx.fillText("60 FPS",inset+18*s,H-inset-20*s);
}
function render(){
  const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);drawBackground(W,H);drawHUD(W,H);
  const s=getScale();const coverBox=Math.min(H*.55,W*.31),coverX=W*.08,coverY=(H-coverBox)/2+5,vinylRadius=coverBox*.50;
  const vinylX=coverX+coverBox*.92,vinylY=coverY+coverBox*.50;drawVinyl(vinylX,vinylY,vinylRadius,vinylAngle);drawCover(coverX,coverY,coverBox,coverBox);
  const tx=W*.62,tw=W*.29;
  drawTextFit(titleInput.value||" ",tx,H*.39,tw,currentFontSize(titleSizeInput),600,textColor);
  drawTextFit(artistInput.value||" ",tx,H*.46,tw,currentFontSize(artistSizeInput),500,accent);
  drawTextFit(subtitleInput.value||" ",tx,H*.515,tw,currentFontSize(subtitleSizeInput),400,mutedColor);
  drawWave(tx,H*.61,tw,70*s);
  const barY=H*.76,tr=hexToRgb(textColor);ctx.fillStyle=`rgba(${tr.r},${tr.g},${tr.b},.18)`;ctx.fillRect(tx,barY,tw,Math.max(4,5*s));const progress=audio.duration?audio.currentTime/audio.duration:0;ctx.fillStyle=accent;ctx.fillRect(tx,barY,tw*clamp(progress,0,1),Math.max(4,5*s));
  ctx.font=`400 ${Math.max(13,18*s)}px ${fontFamily()}`;ctx.fillStyle=mutedColor;ctx.textAlign="left";ctx.fillText(formatTime(audio.currentTime),tx,barY+38*s);ctx.textAlign="center";ctx.fillText("-",tx+tw/2,barY+38*s);ctx.textAlign="right";ctx.fillText(formatTime(audio.duration),tx+tw,barY+38*s);ctx.textAlign="left";
  if(!audio.paused){const delta=Math.max(0,audio.currentTime-lastAudioTime);vinylAngle+=delta*Number(speedInput.value)*Math.PI/2}lastAudioTime=audio.currentTime;
  if(!seeking){const p=audio.duration?audio.currentTime/audio.duration:0;seekInput.value=Math.round(p*1000)}
  currentTimeLabel.textContent=formatTime(audio.currentTime);durationLabel.textContent=formatTime(audio.duration);requestAnimationFrame(render);
}
function resizeCanvas(){const[w,h]=resolutionInput.value.split("x").map(Number);canvas.width=w;canvas.height=h;render()}
function syncButtons(){const ready=!!audio.src;playButton.disabled=!ready;previewPlayButton.disabled=!ready;exportButton.disabled=!(ready&&cover)}

imageInput.addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(file);const img=new Image();img.onload=()=>{cover=img;if(autoColorInput.checked)extractColors(img);syncButtons();exportStatus.textContent=audio.src?"미리보기 준비됨":"음악을 선택해줘"};img.src=imageURL});
audioInput.addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(file);audio.src=audioURL;audio.load();try{setupAudioGraph()}catch(err){console.warn(err)}syncButtons();exportStatus.textContent=`음악 준비됨 · ${file.name}`;if(!titleInput.value||titleInput.value==="NOW PLAYING")titleInput.value=file.name.replace(/\.[^/.]+$/,'')});
async function togglePlay(){if(!audio.src)return;try{setupAudioGraph();if(audioCtx.state==="suspended")await audioCtx.resume();if(audio.paused)await audio.play();else audio.pause()}catch(err){console.error(err);exportStatus.textContent="재생 오류가 발생했어"}}
playButton.addEventListener("click",togglePlay);previewPlayButton.addEventListener("click",togglePlay);
audio.addEventListener("play",()=>{playButton.textContent="일시정지";previewPlayButton.textContent="Ⅱ";exportStatus.textContent=isExporting?"영상 렌더링 중…":"미리보기 재생 중";lastAudioTime=audio.currentTime});
audio.addEventListener("pause",()=>{if(!audio.ended&&!isExporting){playButton.textContent="재생";previewPlayButton.textContent="▶"}});
audio.addEventListener("loadedmetadata",()=>{durationLabel.textContent=formatTime(audio.duration);seekInput.value=0});
audio.addEventListener("ended",()=>{playButton.textContent="재생";previewPlayButton.textContent="▶";if(!isExporting)exportStatus.textContent="재생 완료"});
seekInput.addEventListener("pointerdown",()=>seeking=true);
seekInput.addEventListener("input",()=>{if(!audio.duration)return;const t=(Number(seekInput.value)/1000)*audio.duration;currentTimeLabel.textContent=formatTime(t)});
seekInput.addEventListener("change",()=>{if(!audio.duration){seeking=false;return}audio.currentTime=(Number(seekInput.value)/1000)*audio.duration;lastAudioTime=audio.currentTime;seeking=false});
volumeInput.addEventListener("input",()=>{audio.volume=Number(volumeInput.value)});
autoColorInput.addEventListener("change",()=>{if(autoColorInput.checked&&cover)extractColors(cover)});
resolutionInput.addEventListener("change",resizeCanvas);
[titleInput,artistInput,subtitleInput,fontInput,speedInput,waveInput,titleSizeInput,artistSizeInput,subtitleSizeInput].forEach(el=>el.addEventListener("input",()=>{updateSizeLabels()}));

function getBestMimeType() {
  // The bundled ffmpeg.js MP4 build can decode VP8, but this build does not
  // include a VP9 decoder. Never let MediaRecorder silently choose VP9 here.
  const type = 'video/webm;codecs=vp8,opus';
  return MediaRecorder.isTypeSupported(type) ? type : null;
}

function downloadBlob(blob, ext) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = (titleInput.value || "music-visualizer").replace(/[\\/:*?"<>|]/g, "_");
  a.download = `${safe}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function validateSeekableMp4(blob, expectedDuration) {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("MP4 메타데이터 확인 시간이 초과됐어")), 30000);
      video.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
      video.onerror = () => { clearTimeout(timer); reject(new Error("생성된 MP4를 브라우저에서 읽을 수 없어")); };
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) throw new Error("MP4에 재생 시간이 기록되지 않았어");
    const durationDiff = Math.abs(video.duration - expectedDuration);
    if (durationDiff > 1.5) throw new Error(`MP4 재생 시간이 맞지 않아 (${video.duration.toFixed(2)}초)`);
    if (!video.seekable || video.seekable.length === 0) throw new Error("MP4에 탐색 가능한 재생 구간이 없어");
    return video.duration;
  } finally {
    URL.revokeObjectURL(url);
  }
}

let ffmpegWorker = null;
let ffmpegWorkerURL = null;

async function createMp4Worker() {
  if (ffmpegWorker) return ffmpegWorker;

  // ffmpeg.js 4.2.9003 provides a dedicated MP4 worker with H.264/AAC/MP4 support.
  // We fetch it and create a same-origin Blob worker, avoiding GitHub Pages' cross-origin Worker restriction.
  const workerSourceURL = "https://cdn.jsdelivr.net/npm/ffmpeg.js@4.2.9003/ffmpeg-worker-mp4.js";
  exportStatus.textContent = "MP4 변환 엔진 준비 중… (처음 한 번만 오래 걸릴 수 있어)";

  const response = await fetch(workerSourceURL, { cache: "force-cache" });
  if (!response.ok) throw new Error(`MP4 변환 엔진을 불러오지 못했어 (${response.status})`);
  let source = await response.text();

  // Some builds reference ffmpeg-mp4.js relative to the worker file.
  // Make any such reference absolute so the Blob worker can still load it.
  const moduleURL = "https://cdn.jsdelivr.net/npm/ffmpeg.js@4.2.9003/ffmpeg-mp4.js";
  source = source.replace(/ffmpeg-mp4\.js/g, moduleURL);

  const blob = new Blob([source], { type: "application/javascript" });
  ffmpegWorkerURL = URL.createObjectURL(blob);
  ffmpegWorker = new Worker(ffmpegWorkerURL);
  return ffmpegWorker;
}

function convertWebmToMp4(webmBuffer, expectedDuration) {
  return new Promise(async (resolve, reject) => {
    let worker;
    try {
      worker = await createMp4Worker();
    } catch (err) {
      reject(err);
      return;
    }

    // Reuse the already-created ArrayBuffer instead of making another full copy of the WebM.
    const inputData = new Uint8Array(webmBuffer);
    let finished = false;
    let lastError = "";

    const cleanup = () => {
      if (!worker) return;
      worker.onmessage = null;
      worker.onerror = null;
    };
    const fail = (err) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    worker.onerror = (event) => {
      fail(new Error(event.message || "MP4 변환 Worker에서 오류가 발생했어"));
    };

    worker.onmessage = async (event) => {
      const msg = event.data || {};
      if (msg.type === "ready") {
        exportStatus.textContent = "MP4로 변환 중…";
        worker.postMessage({
          type: "run",
          MEMFS: [{ name: "input.webm", data: inputData }],
          arguments: [
            "-i", "input.webm",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "24",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-y", "output.mp4"
          ]
        });
      } else if (msg.type === "stderr") {
        lastError = String(msg.data || lastError);
        const m = lastError.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (m && Number.isFinite(expectedDuration) && expectedDuration > 0) {
          const sec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
          const pct = clamp(sec / expectedDuration * 100, 0, 99.9);
          exportStatus.textContent = `MP4로 변환 중… ${pct.toFixed(0)}%`;
        }
      } else if (msg.type === "error") {
        fail(new Error(msg.data || "MP4 변환 오류"));
      } else if (msg.type === "abort") {
        fail(new Error(msg.data || "MP4 변환이 중단됐어"));
      } else if (msg.type === "exit") {
        if (Number(msg.data) !== 0) {
          fail(new Error(lastError || `FFmpeg 종료 코드 ${msg.data}`));
        }
      } else if (msg.type === "done") {
        try {
          const files = msg.data && msg.data.MEMFS ? msg.data.MEMFS : [];
          const output = files.find(f => f.name === "output.mp4");
          if (!output || !output.data || output.data.byteLength < 10000) {
            throw new Error(lastError || "MP4 출력 파일이 생성되지 않았어");
          }
          const bytes = output.data instanceof Uint8Array ? output.data : new Uint8Array(output.data);
          const mp4Blob = new Blob([bytes], { type: "video/mp4" });
          exportStatus.textContent = "MP4 재생 정보 확인 중…";
          await validateSeekableMp4(mp4Blob, expectedDuration);
          if (finished) return;
          finished = true;
          cleanup();
          resolve(mp4Blob);
        } catch (err) {
          fail(err);
        }
      }
    };
  });
}

async function exportVideo() {
  if (!audio.src || !cover || isExporting) return;
  if (!window.MediaRecorder || !canvas.captureStream) {
    exportStatus.textContent = "영상 추출 미지원 브라우저입니다.";
    return;
  }
  if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
    exportStatus.textContent = "음악의 재생 시간을 먼저 불러와야 해";
    return;
  }

  const mime = getBestMimeType();
  if (!mime) {
    exportStatus.textContent = "이 브라우저에서는 MP4 변환용 VP8 녹화를 지원하지 않아";
    return;
  }
  isExporting = true;
  exportButton.disabled = true;
  playButton.disabled = true;
  previewPlayButton.disabled = true;
  exportStatus.textContent = "영상 렌더링 준비 중…";

  const oldTime = audio.currentTime, oldVolume = audio.volume, oldPaused = audio.paused;
  let combined = null;
  let dest = null;
  let sourceConnected = false;

  try {
    setupAudioGraph();
    if (audioCtx.state === "suspended") await audioCtx.resume();

    const videoStream = canvas.captureStream(60);
    dest = audioCtx.createMediaStreamDestination();
    sourceNode.connect(dest);
    sourceConnected = true;

    combined = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const chunks = [];
    // Keep the intermediate VP8 file small enough for ffmpeg.js MEMFS.
    // ffmpeg.js keeps both input and output in memory, so a very high WebM bitrate
    // can cause OOM before H.264 encoding even starts.
    const [exportW, exportH] = resolutionInput.value.split("x").map(Number);
    const pixels = exportW * exportH;
    const videoBitrate = pixels >= 1080 * 1080 ? 4500000 : pixels >= 720 * 720 ? 3000000 : 2200000;
    const recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: videoBitrate, audioBitsPerSecond: 128000 });

    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = e => reject(e.error || new Error("렌더링 녹화 오류"));
    });

    audio.pause();
    audio.currentTime = 0;
    audio.volume = 1; // export is always at maximum volume
    vinylAngle = 0;
    lastAudioTime = 0;

    recorder.start(100);
    await audio.play();

    await new Promise((resolve, reject) => {
      const tick = () => {
        if (audio.ended || audio.currentTime >= audio.duration - 0.03) {
          resolve();
          return;
        }
        exportStatus.textContent = `영상 렌더링 중… ${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        requestAnimationFrame(tick);
      };
      tick();
    });

    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    combined.getTracks().forEach(t => t.stop());
    combined = null;

    const rawBlob = new Blob(chunks, { type: mime });
    if (rawBlob.size < 10000) throw new Error("영상 렌더링 결과가 비어 있어");
    if (!rawBlob.type.includes("vp8")) {
      throw new Error(`중간 영상 코덱이 VP8이 아니야 (${rawBlob.type || "알 수 없음"})`);
    }

    exportStatus.textContent = `중간 영상 준비 중… ${(rawBlob.size / 1024 / 1024).toFixed(1)} MB`;
    // Read once, then release the Blob reference before FFmpeg starts. This avoids
    // keeping both the Blob and its ArrayBuffer alive during the memory-heavy step.
    const rawBuffer = await rawBlob.arrayBuffer();
    // WebM is only an intermediate. The downloadable file is always MP4.
    const mp4Blob = await convertWebmToMp4(rawBuffer, audio.duration);
    exportStatus.textContent = "MP4 완성 · 다운로드 준비 중…";
    downloadBlob(mp4Blob, "mp4");
    exportStatus.textContent = "완료 · 재생 바를 움직일 수 있는 MP4가 만들어졌어";
  } catch (err) {
    console.error(err);
    exportStatus.textContent = `추출 오류 · ${err && err.message ? err.message : "알 수 없는 오류"}`;
  } finally {
    try { if (combined) combined.getTracks().forEach(t => t.stop()); } catch {}
    try { if (sourceConnected && sourceNode && typeof sourceNode.disconnect === "function") sourceNode.disconnect(dest); } catch {}
    try {
      audio.pause();
      audio.currentTime = oldTime;
      audio.volume = oldVolume;
      if (!oldPaused) await audio.play();
    } catch {}
    audio.volume = oldVolume;
    isExporting = false;
    syncButtons();
  }
}

exportButton.addEventListener("click", exportVideo);
updateSizeLabels();
resizeCanvas();
audio.volume = 1;
render();
