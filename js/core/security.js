/* ==========================================================================
   Núcleo · senhas
   Guarda apenas o hash PBKDF2-SHA256 (60 mil iterações) com sal por usuário.
   Requer HTTPS (ou localhost), pois usa crypto.subtle.
   ========================================================================== */
(()=>{
const RH=window.RH;
const enc=s=>new TextEncoder().encode(s);
RH.hash=async(pw,salt)=>{
  const k=await crypto.subtle.importKey('raw',enc(pw),'PBKDF2',false,['deriveBits']);
  const b=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc(salt),iterations:60000,hash:'SHA-256'},k,256);
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')};
})();
