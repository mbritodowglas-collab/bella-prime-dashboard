diff --git a/assets/js/app.js b/assets/js/app.js
index 115f860181671357a6993e64cf241a41ded435c2..498ca61e416d8d09638215ad3062f4d62786e68a 100644
--- a/assets/js/app.js
+++ b/assets/js/app.js
@@ -4,95 +4,158 @@
 
 import { DashboardView } from './views/dashboardview.js';
 import { ClienteView }   from './views/clienteview.js';
 import { AvaliacaoView } from './views/avaliacaoview.js';
 
 const SHEETS_API = 'https://script.google.com/macros/s/AKfycbwsOtURP_fuMDzfxysaeVITPZkl2GfRXfz7io9plgAFsgbpScIZGzVTHaRfWPepZv26/exec';
 
 // ---------- Datas ----------
 const todayISO = () => {
   const d = new Date();
   return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 };
 const parseISO = (s) => new Date(`${s}T12:00:00`);
 const diffDays  = (a,b)=> Math.floor((parseISO(a)-parseISO(b))/(1000*60*60*24));
 
 // ---------- Utils ----------
 function cryptoId(){
   try { return crypto.randomUUID(); }
   catch { return 'id_' + Math.random().toString(36).slice(2,9); }
 }
 const strip = (s='') => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const pick = (obj, keys) => {
   for (const k of keys) if (obj[k] !== undefined && obj[k] !== '') return obj[k];
   return undefined;
 };
+const tokenizeKey = (key = '') => strip(key).split(/[^a-z0-9]+/).filter(Boolean);
+const fuzzyPickName = (obj) => {
+  if (!obj) return undefined;
+  let best = null;
+  for (const [rawKey, value] of Object.entries(obj)) {
+    if (value === undefined || value === null) continue;
+    const candidate = typeof value === 'string' ? value.trim() : String(value);
+    if (!candidate) continue;
+    const key = strip(rawKey);
+    if (!key) continue;
+    const tokens = tokenizeKey(key);
+    if (!tokens.length) continue;
+
+    let score = 0;
+
+    for (const token of tokens) {
+      if (token.startsWith('nome')) score += 10;
+      if (token.startsWith('cliente') || token.startsWith('aluno') || token.startsWith('aluna') || token.startsWith('paciente') || token.startsWith('pessoa')) score += 6;
+      if (token.startsWith('responsavel')) score += 2;
+      if (token.includes('completo') || token.includes('full')) score += 2;
+      if (token.includes('social')) score += 1;
+      if (token.includes('apelido')) score -= 1;
+      if (token.includes('status') || token.includes('situacao')) score -= 2;
+      if (token === 'id' || token.includes('codigo') || token.includes('documento')) score -= 6;
+      if (token.includes('email') || token.includes('contato') || token.includes('telefone') || token.includes('whats')) score -= 4;
+      if (token.includes('treino') || token.includes('avaliacao') || token.includes('plano') || token.includes('programa')) score -= 6;
+    }
+
+    if (/(treino|avaliac|plano|programa)/.test(key)) score -= 4;
+
+    if (score <= 0) continue;
+
+    if (!best || score > best.score || (score === best.score && candidate.length > best.value.length)) {
+      best = { score, value: candidate };
+    }
+  }
+
+  return best ? best.value : undefined;
+};
 
 // ---------- Dados (Sheets -> seed.json) ----------
 async function loadSeed(){
   try{
     const r = await fetch(SHEETS_API, { cache:'no-store' });
     if(!r.ok) throw new Error(`Sheets HTTP ${r.status}`);
     const data = await r.json();
     if(!Array.isArray(data)) throw new Error('Sheets retornou formato inválido');
     console.log('Sheets OK:', data.length);
     return data;
   }catch(e){
     console.warn('Sheets falhou, usando seed.json:', e);
     const r2 = await fetch('./assets/data/seed.json', { cache:'no-store' });
     const data = await r2.json();
     console.log('seed.json:', Array.isArray(data) ? data.length : 0);
     return data;
   }
 }
 
 // ---------- Store ----------
 const KEY = 'bp_clientes_v1';
 
+function readPersisted(){
+  try {
+    const raw = localStorage.getItem(KEY);
+    if (!raw) return null;
+    const data = JSON.parse(raw);
+    return Array.isArray(data) ? data : null;
+  } catch (e) {
+    console.warn('Falha ao ler cache local:', e);
+    return null;
+  }
+}
+
 export const Store = {
   state: {
     clientes: [],
     filters: { q:'', nivel:'', status:'' },
     scroll: { '/': 0 }
   },
 
   async init(){
+    const cached = readPersisted();
+    if (Array.isArray(cached) && cached.length && this.state.clientes.length === 0){
+      this.state.clientes = cached;
+      console.log(`🔁 Cache local: ${cached.length} clientes`);
+    }
+
     try{
       const brutos = await loadSeed();
 
       // 1) normaliza chaves (case/acentos) por linha
       const normRow = (raw) => {
         const o = {};
         for (const [k, v] of Object.entries(raw || {})) o[strip(k)] = v;
         return o;
       };
 
       // 2) transforma cada linha em um "registro base" com avaliação opcional
       const registros = (brutos || []).map(raw => {
         const o = normRow(raw);
 
-        const nome    = pick(o, ['nome','aluna','cliente','paciente']);
+        const nome    = pick(o, [
+          'nome','aluna','aluno','cliente','paciente','pessoa','responsavel',
+          'nomecliente','nome cliente','nome do cliente','nome da cliente','nome cliente completo',
+          'nomedacliente','nome da aluna','nomedaaluna','nome da pessoa','nomedapessoa',
+          'nome completo','nomecompleto','nome do aluno','nome do paciente','nome aluno','nome paciente',
+          'nome social','nomesocial','nome responsavel','nome do responsavel'
+        ]) || fuzzyPickName(o);
         const contato = pick(o, ['contato','whatsapp','whats','telefone']);
         const email   = pick(o, ['email','e-mail','mail']);
         const id      = String(pick(o, ['id','identificador','uid','usuario']) || contato || email || cryptoId());
 
         // Aceita várias formas de "Cidade - Estado"
         const cidade = pick(o, [
           'cidade-estado','cidade - estado','cidade/estado','cidade_estado',
           'cidade-uf','cidade uf','cidadeuf','cidade'
         ]) || '';
 
         // Campos de avaliação (data / pontuação / nível)
         const dataAval = pick(o, ['data','dataavaliacao','data da avaliacao','ultimotreino','ultimaavaliacao']);
         const pont     = Number(pick(o, ['pontuacao','pontuação','score','pontos','nota']) || 0);
         const nivelIn  = pick(o, ['nivel','nível','nivelatual','fase','faixa']);
 
         // normaliza nível
         const nivel = (() => {
           const n = strip(nivelIn || '');
           if (n.startsWith('fund')) return 'Fundação';
           if (n.startsWith('asc'))  return 'Ascensão';
           if (n.startsWith('dom'))  return 'Domínio';
           if (n.startsWith('over')) return 'OverPrime';
           if (pont <= 2)  return 'Fundação';
           if (pont <= 6)  return 'Ascensão';
           if (pont <= 10) return 'Domínio';
@@ -137,59 +200,68 @@ export const Store = {
         }
 
         // mescla avaliações
         const avs = [...(dst.avaliacoes||[]), ...(r.avaliacoes||[])];
         const seen = new Set(); const dedup = [];
         for (const a of avs) {
           const key = `${a.data}|${a.pontuacao}`;
           if (!seen.has(key)) { seen.add(key); dedup.push(a); }
         }
         dedup.sort((a,b)=> a.data.localeCompare(b.data));
         dst.avaliacoes = dedup;
 
         const last = dedup[dedup.length-1];
         if (last) {
           dst.pontuacao    = last.pontuacao;
           dst.nivel        = last.nivel || dst.nivel;
           dst.ultimoTreino = dst.ultimoTreino || last.data;
         }
       }
 
       this.state.clientes = [...map.values()];
       this.persist();
       console.log(`✅ Normalizado: ${this.state.clientes.length} clientes`);
     }catch(e){
       console.error('Falha init()', e);
-      this.state.clientes = [];
+      if (!this.state.clientes.length && Array.isArray(cached)){
+        this.state.clientes = cached;
+        console.log(`⚠️ Usando cache local: ${cached.length} clientes`);
+      }
     }
   },
 
   async reloadFromSheets(){
     await this.init();
   },
 
-  persist(){ localStorage.setItem(KEY, JSON.stringify(this.state.clientes)); },
+  persist(){
+    try {
+      localStorage.setItem(KEY, JSON.stringify(this.state.clientes));
+    } catch (e) {
+      console.warn('Falha ao salvar no localStorage:', e);
+    }
+  },
 
   list(){
     const { q='', nivel='', status='' } = this.state.filters || {};
     return [...this.state.clientes]
       .sort((a,b)=> (a.nome||'').localeCompare(b.nome||'','pt',{sensitivity:'base'}))
       .filter(c => !q     || (c.nome||'').toLowerCase().includes(q.toLowerCase()))
       .filter(c => !nivel || c.nivel === nivel)
       .filter(c => !status|| statusCalc(c).label === status);
   },
 
   byId(id){ return this.state.clientes.find(c => String(c.id) === String(id)); },
 
   upsert(c){
     const i = this.state.clientes.findIndex(x => String(x.id) === String(c.id));
     if (i >= 0) this.state.clientes[i] = c; else this.state.clientes.push(c);
     this.persist();
   },
 
   exportJSON(){
     const blob = new Blob([JSON.stringify(this.state.clientes, null, 2)], { type:'application/json' });
     const a = document.createElement('a');
     a.href = URL.createObjectURL(blob);
     a.download = `clientes-${todayISO()}.json`;
     a.click();
     URL.revokeObjectURL(a.href);
