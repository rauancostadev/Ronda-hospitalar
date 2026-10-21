/* ==========================================================================
   Núcleo · imagens
   Reduz fotos (câmera do celular) antes de gravar: miniatura 160 px e versão
   completa 960 px, ambas em JPEG. Devolve {thumb, full} (data URLs).
   ========================================================================== */
(()=>{
const RH=window.RH;
function readImg(file,max,q){return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=rej;fr.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{
  const k=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));
  c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',q))};im.src=fr.result};fr.readAsDataURL(file)})}
RH.processImg=async file=>({thumb:await readImg(file,160,.6),full:await readImg(file,960,.7)});
})();
