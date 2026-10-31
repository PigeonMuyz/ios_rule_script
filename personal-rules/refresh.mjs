#!/usr/bin/env node
// Only public rule data is read or published. This script never reads client profiles.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const ORIGIN = 'https://magicrule.pages.dev';
const REPO = 'PigeonMuyz/ios_rule_script';
const PREFIX = 'personal-rules';
const sha = text => createHash('sha256').update(text).digest('hex');
const seeds = {
  OpenAI: ['openai.com','chatgpt.com','chatgpt.site','chat.com','sora.com','oaistatic.com','oaiusercontent.com'],
  Anthropic: ['anthropic.com','claude.ai','claude.com','claudeusercontent.com'],
  Gemini: ['gemini.google.com','generativelanguage.googleapis.com','aistudio.google.com','notebooklm.google.com','antigravity.google'],
  Cursor: ['cursor.com','cursor.sh','cursorapi.com','cursor-cdn.com','cursorvm.com'],
  Perplexity: ['perplexity.ai','pplx.ai'],
  Copilot: ['githubcopilot.com','githubcopilot.net','copilot.microsoft.com'],
};
const roots = {
  OpenAI: [...seeds.OpenAI,'openai.org','oaistatsig.com','ai.com','chatgpt.livekit.cloud'],
  Anthropic: [...seeds.Anthropic,'claude.app','claude.dev','claude.new','claude.site',
    'claudemcpcontent.com','claudemcpclient.com','modelcontextprotocol.io','modelcontextprotocol.org'],
  Gemini: [...seeds.Gemini,'gemini.google','gemini.gstatic.com','ai.google.dev','ai.studio',
    'bard.google.com','makersuite.google.com','generativeai.google','aistudio.google',
    'antigravity-unleash.goog','notebooklm.google','notebooklmusercontent.google.com',
    'flow.google','flow.google.com','jules.google','jules.google.com','labs.google','labs.google.com',
    'notebook.google','notebook.google.com','opal.google','opal.google.com','stitch.withgoogle.com'],
  Cursor: seeds.Cursor,
  Perplexity: [...seeds.Perplexity,'perplexity.com'],
  Copilot: [...seeds.Copilot,'copilot.cloud.microsoft','copilot.live.com','copilotstudio.microsoft.com',
    'copilot-proxy.githubusercontent.com','copilot-telemetry-service.githubusercontent.com',
    'copilot-telemetry.githubusercontent.com','copilot-workspace.githubnext.com',
    'copilotprodattachments.blob.core.windows.net'],
};
const sharedRoots = new Set(['auth0.com','stripe.com','sentry.io','algolia.net','intercom.io',
  'intercomcdn.com','statsigapi.net','featuregates.org','launchdarkly.com','segment.io',
  'datadoghq.com','cloudflare.com','microsoft.com','google.com','googleapis.com',
  'cloudfront.net','akamaized.net','akamaihd.net','azureedge.net','windows.net','amazonaws.com',
  'github.com','githubusercontent.com','googleusercontent.com','gstatic.com','helpshift.com',
  'hackyourconsole.com','steamunlocked.net','steaminventoryhelper.com','sih.app','sih-db.com']);
const categories = ['OpenAI','Anthropic','Gemini','Cursor','Perplexity','Copilot',
  'Steam','Epic','Xbox','PlayStation','Nintendo','HoYoverse'];
const games = new Set(categories.slice(6));
const archive = {};
const provenance = [];
const exclusions = [];

function download(url) {
  if (!/^https:\/\//.test(url)) throw Error('HTTPS source required');
  const text = execFileSync('curl',['-fsSL','--retry','2','--connect-timeout','8','--max-time','30',url],
    {encoding:'utf8',maxBuffer:12e6});
  if (/<html|<!doctype/i.test(text) || !text.trim()) throw Error('Empty or HTML rule response');
  return text;
}
const within = (domain,root) => domain === root || domain.endsWith('.'+root);
function selected(name,type,domain) {
  if (!['DOMAIN','DOMAIN-SUFFIX'].includes(type)) return false;
  if (!/^[a-z0-9_.-]+$/.test(domain) || domain.endsWith('.cn') || domain === 'cn') return false;
  if (games.has(name)) return !sharedRoots.has(domain);
  if ((roots[name]||[]).some(root=>within(domain,root))) return true;
  if (name === 'Gemini') {
    if (domain === 'apis.google.com') return false;
    return /^(?:alkalicore-pa|alkalimakersuite-pa|appsgenaiserver-pa|geminiweb-pa|webchannel-alkalimakersuite-pa)\.clients6?\.google\.com$/.test(domain)
      || /^(?:antigravity(?:-pa)?|appsgenaiserver-pa|cloudaicompanion|cloudcode-pa|daily-cloudcode-pa|notebooklm(?:-pa)?|aicode|aida|aisandbox-pa|geller-pa|generativelanguage|labstailwind\.pa|proactivebackend-pa|robinfrontend-pa)\.googleapis\.com$/.test(domain);
  }
  if (name === 'OpenAI') return /^(?:openai|openaicom|production-openaicom)[a-z0-9.-]*\.(?:azureedge\.net|blob\.core\.windows\.net|imgix\.net|azurefd\.net)$/.test(domain)
    || domain === 'openai-api.arkoselabs.com';
  if (name === 'Perplexity') return ['ppl-ai-file-upload.s3.amazonaws.com','pplx-res.cloudinary.com'].includes(domain);
  return false;
}
function minimize(lines) {
  const unique = [...new Set(lines)].sort();
  const suffixes = unique.filter(l=>l.startsWith('DOMAIN-SUFFIX,')).map(l=>l.split(',')[1]);
  return unique.filter(line=>{
    const [type,domain]=line.split(',');
    return !suffixes.some(root=>within(domain,root) && (type==='DOMAIN'||domain!==root));
  });
}
function file(name,lines,description) {
  lines=minimize(lines);
  if (!lines.length) throw Error('No accepted rules: '+name);
  archive[PREFIX+'/'+name+'.list'] =
    '# NAME: '+name+'\n# OWNER: '+REPO+'\n# '+description+
    '\n# Public domains only; CN routing remains DIRECT in the client profiles.\n\n'+lines.join('\n')+'\n';
}
for (const client of ['Surge','Loon']) {
  const index=JSON.parse(download(ORIGIN+'/data/index/'+client+'.json'));
  if (index.client!==client || !Array.isArray(index.rules)) throw Error('Invalid index');
  const selectedSets={};
  for (const name of categories) {
    const entry=index.rules.find(rule=>rule.name===name);
    if (!entry) throw Error('Missing category: '+client+'/'+name);
    const manifest=JSON.parse(download(entry.manifest));
    if (manifest.rule!==name || manifest.client!==client) throw Error('Invalid manifest identity');
    const artifact=manifest.artifacts.find(a=>a.role==='full'&&!a.binary&&!a.empty);
    if (!artifact) throw Error('No full artifact');
    const text=download(artifact.url);
    if (!text.split(/\r?\n/).includes('# NAME: '+name))
      throw Error('Unexpected artifact identity: '+client+'/'+name);
    // Some shared artifacts have bytes that differ from the manifest digest.
    // Validate identity, syntax and the allowlist, then record both digests.
    const manifestChecksumMatched = !artifact.dedupe?.bytes_sha256
      || sha(text)===artifact.dedupe.bytes_sha256;
    const lines=[];
    for (let line of text.split(/\r?\n/)) {
      line=line.trim();if(!line||line.startsWith('#')||line.startsWith('//'))continue;
      const [type,raw]=line.split(',');const domain=(raw||'').toLowerCase();
      if (selected(name,type,domain)) lines.push(type+','+domain);
      else exclusions.push({client,category:name,line});
    }
    for(const domain of seeds[name]||[])lines.push('DOMAIN-SUFFIX,'+domain);
    selectedSets[name]=minimize(lines);
    provenance.push({client,category:name,index:ORIGIN+'/data/index/'+client+'.json',
      manifest:entry.manifest,artifact:artifact.url,indexGenerated:index.generated_at,
      ruleUpdated:manifest.rule_updated_at,sha256:sha(text),
      manifestSha256:artifact.dedupe?.bytes_sha256,manifestChecksumMatched,
      sourceLines:text.split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).length,
      accepted:selectedSets[name].length});
  }
  for(const name of ['OpenAI','Anthropic','Gemini'])
    file(client+'/'+name,selectedSets[name],'MagicRule source screened to service-specific domains.');
  file(client+'/AITools',['Cursor','Perplexity','Copilot'].flatMap(name=>selectedSets[name]),
    'Cursor + Perplexity + GitHub/Microsoft Copilot; excludes shared cloud/login/payment roots.');
  file(client+'/Games',[...games].flatMap(name=>selectedSets[name]),
    'Steam + Epic + Xbox + PlayStation + Nintendo + HoYoverse; domain rules only.');
  file(client+'/BiliDomestic',
    ['bilibili.com','bilibili.cn','bilibili.net','biliapi.com','biliapi.net','biliimg.com',
      'bilivideo.com','bilivideo.cn','bilivideo.net','acgvideo.com','hdslb.com',
      'hdslb.net','b23.tv','acg.tv'].map(d=>'DOMAIN-SUFFIX,'+d),
    'Mainland Bilibili services; excludes Bilibili international services.');
}
archive[PREFIX+'/provenance.json']=JSON.stringify({version:1,
  policy:'Exact/suffix domains only. No shared root, process, ASN, keyword, or IP rules for curated AI.',
  sources:provenance,excluded:[...new Set(exclusions.map(e=>e.line))].sort()},null,2)+'\n';
const summary=Object.entries(archive).filter(([p])=>p.endsWith('.list'))
  .map(([path,text])=>({path,rules:text.split('\n').filter(l=>l&&!l.startsWith('#')).length,sha256:sha(text)}));
archive[PREFIX+'/refresh.mjs']=readFileSync(new URL('./refresh.mjs',import.meta.url),'utf8');
archive[PREFIX+'/README.md']=readFileSync(new URL('./README.md',import.meta.url),'utf8');

if (process.argv.includes('--publish')) {
  const api=(path,data)=>JSON.parse(execFileSync('gh',
    ['api',path,...(data?['--method','POST','--input','-']:[])],
    {input:data?JSON.stringify(data):undefined,encoding:'utf8',maxBuffer:12e6}));
  const ref=api('repos/'+REPO+'/git/ref/heads/master');
  const parent=api('repos/'+REPO+'/git/commits/'+ref.object.sha);
  const tree=api('repos/'+REPO+'/git/trees',{base_tree:parent.tree.sha,
    tree:Object.entries(archive).map(([path,content])=>({path,mode:'100644',type:'blob',content}))});
  if(tree.sha===parent.tree.sha) {console.log(JSON.stringify({updated:false,summary}));process.exit(0)}
  const commit=api('repos/'+REPO+'/git/commits',{
    message:'更新筛选后的 Surge 与 Loon AI、游戏和 B 站规则',tree:tree.sha,parents:[ref.object.sha]});
  execFileSync('gh',['api','repos/'+REPO+'/git/refs/heads/master','--method','PATCH','--input','-'],
    {input:JSON.stringify({sha:commit.sha,force:false}),encoding:'utf8'});
  console.log(JSON.stringify({updated:true,commit:commit.sha,summary}));
} else {
  console.log(JSON.stringify({files:archive,summary}));
}
