const canvas=document.getElementById("canvas"),ctx=canvas.getContext("2d");
const audio=document.getElementById("audio");
const imageInput=document.getElementById("imageInput"),audioInput=document.getElementById("audioInput");
const playButton=document.getElementById("playButton"),exportButton=document.getElementById("exportButton"),exportStatus=document.getElementById("exportStatus");
const titleInput=document.getElementById("titleInput"),artistInput=document.getElementById("artistInput"),subtitleInput=document.getElementById("subtitleInput"),fontInput=document.getElementById("fontInput");
const speedInput=document.getElementById("speedInput"),waveInput=document.getElementById("waveInput"),autoColorInput=document.getElementById("autoColorInput"),resolutionInput=document.getElementById("resolutionInput");
const seekInput=document.getElementById("seekInput"),volumeInput=document.getElementById("volumeInput"),currentTimeLabel=document.getElementById("currentTimeLabel"),durationLabel=document.getElementById("durationLabel");
let cover=null,accent="#d6bd1c",bgColor="#d9d8cc",textColor="#1f1f1b",mutedColor="#66645b",audioURL=null,imageURL=null;
let audioCtx=null,analyser=null,sourceNode=null,freqData=null,isExporting=false,raf=0,vinylAngle=0,lastAudioTime=0,seeking=false;

function hexToRgb(hex){const n=parseInt(hex.slice(1),16);return{r:(n>>16)&255,g:(n>>8)&255,b:n&255}}
function rgbToHex(r,g,b){return"#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("")}
function luminance(r,g,b){return .2126*r+.7152*g+.0722*b}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function formatTime(seconds){if(!Number.isFinite(seconds))return"00:00";const s=Math.max(0,Math.floor(seconds)),m=Math.floor(s/60);return`${String(m).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function fontFamily(){const f=fontInput.value;return f.includes(" ")?`"${f}"`:f}

function extractColors(img){
  const c=document.createElement("canvas");c.width=120;c.height=120;const x=c.getContext("2d");x.drawImage(img,0,0,120,120);const data=x.getImageData(0,0,120,120).data;
  let sr=0,sg=0,sb=0,count=0;const buckets=new Map();
  for(let i=0;i<data.length;i+=16){const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];if(a<180)continue;sr+=r;sg+=g;sb+=b;count++;const q=[Math.round(r/24)*24,Math.round(g/24)*24,Math.round(b/24)*24],key=q.join(",");buckets.set(key,(buckets.get(key)||0)+1)}
  let best=[210,190,40],bestScore=-1;
  for(const[key,n]of buckets){const[r,g,b]=key.split(",").map(Number),sat=Math.max(r,g,b)-Math.min(r,g,b),lum=luminance(r,g,b),score=n*(1+sat/180)*(1-Math.abs(lum-145)/330);if(score>bestScore){bestScore=score;best=[r,g,b]}}
  const avgLum=count?luminance(sr/count,sg/count,sb/count):128;accent=rgbToHex(...best);bgColor=rgbToHex((sr/count)||128,(sg/count)||128,(sb/count)||128);
  if(avgLum<145){textColor="#f5f5f0";mutedColor="#d2d1c8"}else{textColor="#20201c";mutedColor="#5e5c54"}
  document.documentElement.style.setProperty("--accent",accent);
}

function setupAudioGraph(){
  if(audioCtx)return;
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();analyser=audioCtx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.72;freqData=new Uint8Array(analyser.frequencyBinCount);
  sourceNode=audioCtx.createMediaElementSource(audio);sourceNode.connect(analyser);analyser.connect(audioCtx.destination);
}
function drawBackground(W,H){
  if(!cover){ctx.fillStyle="#080d17";ctx.fillRect(0,0,W,H);return}
  ctx.save();ctx.filter=`blur(${Math.max(20,Math.round(W*.022))}px)`;const iw=cover.naturalWidth||cover.width,ih=cover.naturalHeight||cover.height,scale=Math.max(W/iw,H/ih)*1.16,dw=iw*scale,dh=ih*scale;ctx.globalAlpha=.72;ctx.drawImage(cover,(W-dw)/2,(H-dh)/2,dw,dh);ctx.restore();
  const rgb=hexToRgb(bgColor),avg=luminance(rgb.r,rgb.g,rgb.b);ctx.fillStyle=avg<145?"rgba(0,0,0,.42)":"rgba(255,255,245,.42)";ctx.fillRect(0,0,W,H);ctx.fillStyle="rgba(255,255,255,.055)";ctx.fillRect(0,0,W,H)
}
function drawVinyl(cx,cy,radius,angle){
  ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.shadowColor="rgba(0,0,0,.25)";ctx.shadowBlur=22;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fillStyle="#080a0f";ctx.fill();ctx.shadowBlur=0;
  for(let r=radius-4;r>radius*.25;r-=7){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.strokeStyle="rgba(255,255,255,.035)";ctx.lineWidth=1;ctx.stroke()}
  ctx.beginPath();ctx.arc(0,0,radius*.28,0,Math.PI*2);ctx.fillStyle="#11151e";ctx.fill();
  if(cover){ctx.save();ctx.beginPath();ctx.arc(0,0,radius*.255,0,Math.PI*2);ctx.clip();ctx.drawImage(cover,-radius*.255,-radius*.255,radius*.51,radius*.51);ctx.restore()}
  ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fillStyle="#cfd5e2";ctx.fill();ctx.restore();
}
function drawCover(x,y,w,h){if(!cover)return;ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,34);ctx.clip();ctx.drawImage(cover,x,y,w,h);ctx.restore()}
function drawWave(x,y,w,h){
  const bars=96,gap=5,bw=Math.max(2,(w-gap*(bars-1))/bars);let level=.06;
  if(analyser&&freqData){analyser.getByteFrequencyData(freqData);let sum=0;for(let i=0;i<freqData.length;i++)sum+=freqData[i];level=sum/(freqData.length*255)}
  const rgb=hexToRgb(accent);
  for(let i=0;i<bars;i++){let v=.08;if(analyser&&freqData){const idx=Math.floor((i/bars)*freqData.length*.55);v=(freqData[Math.min(freqData.length-1,idx)]||0)/255}else v=.08;const motion=audio.paused?.45:1,bh=Math.max(3,(v*.78+.05*level)*h*Number(waveInput.value)*motion),xx=x+i*(bw+gap);ctx.fillStyle=`rgba(${rgb.r},${rgb.g},${rgb.b},${.42+v*.55})`;ctx.fillRect(xx,y+h/2-bh/2,bw,bh)}
}
function drawHUD(W,H){
  const a=hexToRgb(accent);ctx.strokeStyle="rgba(210,220,235,.35)";ctx.lineWidth=1;ctx.strokeRect(44,44,W-88,H-88);
  ctx.strokeStyle=`rgba(${a.r},${a.g},${a.b},.9)`;ctx.lineWidth=4;
  const corners=[[44,44,112,44,44,112],[W-44,44,W-112,44,W-44,112],[44,H-44,112,H-44,44,H-112],[W-44,H-44,W-112,H-44,W-44,H-112]];
  for(const[x1,y1,x2,y2,x3,y3]of corners){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.moveTo(x1,y1);ctx.lineTo(x3,y3);ctx.stroke()}
  ctx.strokeStyle=`rgba(${a.r},${a.g},${a.b},.45)`;ctx.lineWidth=1;
  for(let x=W*.36;x<W*.64;x+=14){ctx.beginPath();ctx.moveTo(x,48);ctx.lineTo(x,56+(Math.round(x)%5)*3);ctx.stroke()}
  for(let y=H*.33;y<H*.68;y+=15){ctx.beginPath();ctx.moveTo(50,y);ctx.lineTo(58,y);ctx.stroke()}
  ctx.fillStyle=textColor;ctx.font=`500 16px ${fontFamily()}`;ctx.fillText(formatTime(audio.currentTime),W-70,82);ctx.textAlign="left";
  ctx.fillStyle=mutedColor;ctx.font=`400 14px "Space Mono",monospace`;ctx.fillText("60 FPS",70,H-70);ctx.textAlign="left";
}
function render(){
  const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);drawBackground(W,H);drawHUD(W,H);
  const coverSize=Math.min(H*.55,W*.31),coverX=W*.08,coverY=(H-coverSize)/2+5,vinylRadius=coverSize*.50;
  // Vinyl sits behind the cover and stays to the left of the text block.
  const vinylX=coverX+coverSize*.92,vinylY=coverY+coverSize*.50;drawVinyl(vinylX,vinylY,vinylRadius,vinylAngle);drawCover(coverX,coverY,coverSize,coverSize);
  const tx=W*.62,tw=W*.29;
  ctx.font=`600 ${Math.max(42,W*.033)}px ${fontFamily()}`;ctx.fillStyle=textColor;ctx.fillText(titleInput.value||" ",tx,H*.39);
  ctx.font=`500 24px ${fontFamily()}`;ctx.fillStyle=accent;ctx.fillText(artistInput.value||" ",tx,H*.46);
  ctx.font=`400 18px ${fontFamily()}`;ctx.fillStyle=mutedColor;ctx.fillText(subtitleInput.value||" ",tx,H*.515);
  drawWave(tx,H*.61,tw,70);
  const barY=H*.76;const tr=hexToRgb(textColor);ctx.fillStyle=`rgba(${tr.r},${tr.g},${tr.b},.18)`;ctx.fillRect(tx,barY,tw,5);const progress=audio.duration?audio.currentTime/audio.duration:0;ctx.fillStyle=accent;ctx.fillRect(tx,barY,tw*clamp(progress,0,1),5);
  ctx.font=`400 18px ${fontFamily()}`;ctx.fillStyle=mutedColor;ctx.fillText(formatTime(audio.currentTime),tx,barY+38);ctx.textAlign="right";ctx.fillText(formatTime(audio.duration),tx+tw,barY+38);ctx.textAlign="left";
  if(!audio.paused&&!isExporting){const delta=Math.max(0,audio.currentTime-lastAudioTime);vinylAngle+=delta*Number(speedInput.value)*Math.PI/2}lastAudioTime=audio.currentTime;
  if(!seeking){const p=audio.duration?audio.currentTime/audio.duration:0;seekInput.value=Math.round(p*1000)}
  currentTimeLabel.textContent=formatTime(audio.currentTime);durationLabel.textContent=formatTime(audio.duration);
  raf=requestAnimationFrame(render);
}
function resizeCanvas(){const[w,h]=resolutionInput.value.split("x").map(Number);canvas.width=w;canvas.height=h}

imageInput.addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(file);const img=new Image();img.onload=()=>{cover=img;if(autoColorInput.checked)extractColors(img);exportButton.disabled=!audio.src;exportStatus.textContent=audio.src?"미리보기 준비됨":"음악을 선택해줘"};img.src=imageURL});
audioInput.addEventListener("change",e=>{const file=e.target.files[0];if(!file)return;if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(file);audio.src=audioURL;audio.load();try{setupAudioGraph()}catch(err){console.warn(err)}playButton.disabled=false;exportButton.disabled=!cover;exportStatus.textContent=`음악 준비됨 · ${file.name}`;if(!titleInput.value)titleInput.value=file.name.replace(/\.[^/.]+$/,'')});
playButton.addEventListener("click",async()=>{if(!audio.src)return;try{setupAudioGraph();if(audioCtx.state==="suspended")await audioCtx.resume();if(audio.paused)await audio.play();else audio.pause()}catch(err){console.error(err);exportStatus.textContent="재생 오류가 발생했어"}});
audio.addEventListener("play",()=>{playButton.textContent="일시정지";exportStatus.textContent=isExporting?"영상 렌더링 중…":"미리보기 재생 중";lastAudioTime=audio.currentTime});
audio.addEventListener("pause",()=>{if(!audio.ended&&!isExporting)playButton.textContent="재생"});
audio.addEventListener("loadedmetadata",()=>{durationLabel.textContent=formatTime(audio.duration);seekInput.value=0});
audio.addEventListener("ended",()=>{playButton.textContent="재생";if(!isExporting)exportStatus.textContent="재생 완료"});
seekInput.addEventListener("pointerdown",()=>seeking=true);
seekInput.addEventListener("input",()=>{if(!audio.duration)return;const t=(Number(seekInput.value)/1000)*audio.duration;currentTimeLabel.textContent=formatTime(t)});
seekInput.addEventListener("change",()=>{if(!audio.duration){seeking=false;return}audio.currentTime=(Number(seekInput.value)/1000)*audio.duration;lastAudioTime=audio.currentTime;seeking=false});
volumeInput.addEventListener("input",()=>{audio.volume=Number(volumeInput.value)});
autoColorInput.addEventListener("change",()=>{if(autoColorInput.checked&&cover)extractColors(cover)});
resolutionInput.addEventListener("change",resizeCanvas);

let ffmpegInstance=null;
let ffmpegLoading=null;

async function loadFFmpeg(){
  if(ffmpegInstance?.isLoaded())return ffmpegInstance;
  if(ffmpegLoading)return ffmpegLoading;
  ffmpegLoading=(async()=>{
    if(!window.FFmpeg){
      await new Promise((resolve,reject)=>{
        const script=document.createElement("script");
        script.src="https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js";
        script.onload=resolve;
        script.onerror=()=>reject(new Error("MP4 변환 모듈을 불러오지 못했어"));
        document.head.appendChild(script);
      });
    }
    const {createFFmpeg}=window.FFmpeg;
    ffmpegInstance=createFFmpeg({
      log:false,
      corePath:"https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js"
    });
    ffmpegInstance.setProgress(({ratio})=>{
      const pct=clamp(Math.round(ratio*100),0,100);
      exportStatus.textContent=`MP4 변환 중… ${pct}%`;
    });
    exportStatus.textContent="MP4 변환 모듈 준비 중…";
    await ffmpegInstance.load();
    return ffmpegInstance;
  })();
  try{return await ffmpegLoading}
  finally{ffmpegLoading=null}
}

async function exportVideo(){
  if(!audio.src||!cover||isExporting)return;
  if(!window.MediaRecorder||!canvas.captureStream){exportStatus.textContent="이 브라우저는 영상 추출을 지원하지 않아";return}
  isExporting=true;exportButton.disabled=true;playButton.disabled=true;exportStatus.textContent="MP4 추출 준비 중…";
  const oldTime=audio.currentTime,oldVolume=audio.volume,oldPaused=audio.paused;
  let combined=null,recordedBlob=null;
  try{
    setupAudioGraph();
    if(audioCtx.state==="suspended")await audioCtx.resume();

    // 브라우저에서는 임시로 WebM 스트림을 만들고, FFmpeg가 최종 MP4(H.264/AAC)로 변환한다.
    // WebM은 사용자에게 다운로드되지 않는다.
    const videoStream=canvas.captureStream(60);
    const dest=audioCtx.createMediaStreamDestination();
    sourceNode.connect(dest);
    combined=new MediaStream([...videoStream.getVideoTracks(),...dest.stream.getAudioTracks()]);

    const internalTypes=[
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm"
    ];
    const internalMime=internalTypes.find(x=>MediaRecorder.isTypeSupported(x));
    if(!internalMime)throw new Error("이 브라우저에서 임시 영상 생성을 지원하지 않아");

    const chunks=[];
    const recorder=new MediaRecorder(combined,{mimeType:internalMime,videoBitsPerSecond:12000000});
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    const stopped=new Promise((resolve,reject)=>{
      recorder.onstop=resolve;
      recorder.onerror=e=>reject(e.error||new Error("영상 렌더링 오류"));
    });

    audio.pause();
    audio.currentTime=0;
    audio.volume=1;
    vinylAngle=0;
    lastAudioTime=0;
    recorder.start(250);
    await audio.play();

    await new Promise((resolve,reject)=>{
      let lastShown=-1;
      const tick=()=>{
        if(audio.ended||audio.currentTime>=audio.duration-.03){resolve();return}
        const sec=Math.floor(audio.currentTime);
        if(sec!==lastShown){
          lastShown=sec;
          exportStatus.textContent=`영상 렌더링 중… ${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });

    if(recorder.state!=="inactive")recorder.stop();
    await stopped;
    combined.getTracks().forEach(t=>t.stop());
    combined=null;

    recordedBlob=new Blob(chunks,{type:internalMime});
    if(recordedBlob.size<10000)throw new Error("영상 데이터가 충분히 생성되지 않았어");

    const ffmpeg=await loadFFmpeg();
    const inputName="visualizer-input.webm";
    const outputName="visualizer-output.mp4";
    const {fetchFile}=window.FFmpeg;
    try{ffmpeg.FS("unlink",inputName)}catch{}
    try{ffmpeg.FS("unlink",outputName)}catch{}
    ffmpeg.FS("writeFile",inputName,await fetchFile(recordedBlob));

    exportStatus.textContent="MP4 변환 중… 0%";
    await ffmpeg.run(
      "-i",inputName,
      "-c:v","libx264",
      "-preset","veryfast",
      "-crf","18",
      "-pix_fmt","yuv420p",
      "-c:a","aac",
      "-b:a","192k",
      "-movflags","+faststart",
      outputName
    );

    const data=ffmpeg.FS("readFile",outputName);
    const mp4Blob=new Blob([data.buffer],{type:"video/mp4"});
    if(mp4Blob.size<10000)throw new Error("MP4 파일이 정상적으로 생성되지 않았어");

    const url=URL.createObjectURL(mp4Blob),a=document.createElement("a");
    a.href=url;
    const safe=(titleInput.value||"music-visualizer").replace(/[\\/:*?"<>|]/g,"_");
    a.download=`${safe}.mp4`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);

    try{ffmpeg.FS("unlink",inputName)}catch{}
    try{ffmpeg.FS("unlink",outputName)}catch{}
    exportStatus.textContent="완료 · MP4 영상이 다운로드됐어";
  }catch(err){
    console.error(err);
    exportStatus.textContent=`추출 오류 · ${err.message||"알 수 없는 오류"}`;
    if(combined)combined.getTracks().forEach(t=>t.stop());
    try{audio.pause();audio.currentTime=oldTime;audio.volume=oldVolume;if(!oldPaused)await audio.play()}catch{}
  }finally{
    audio.volume=oldVolume;
    isExporting=false;
    exportButton.disabled=!cover||!audio.src;
    playButton.disabled=!audio.src;
  }
}
exportButton.addEventListener("click",exportVideo);
[titleInput,artistInput,subtitleInput,fontInput,speedInput,waveInput].forEach(el=>el.addEventListener("input",()=>{}));
resizeCanvas();audio.volume=1;render();
