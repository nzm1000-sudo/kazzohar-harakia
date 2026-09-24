// Read-only corpus verification. No automatic re-import, deduplication or text rewriting.
// --online additionally compares each full requested ref against its exact stored edition.
// A network/edition/ref mismatch is UNVERIFIED, never PASS.
import { writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import books from '../src/data/booksOffline.mjs';
import { BOOK_CATALOG } from '../src/data/bookCatalog.mjs';
import { assessBook, flattenText, compareBookEdition } from '../src/services/bookIntegrity.mjs';
import { requestJsonResponse } from '../src/services/requestJson.mjs';
const args=process.argv.slice(2);
const online=args.includes('--online');
const strict=args.includes('--strict');
const hash=values=>createHash('sha256').update(JSON.stringify(values)).digest('hex');
const canonical=ref=>String(ref||'').replaceAll('_',' ').replace(/\s+/g,' ').trim();
const getArg=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]};
const only=getArg('--only');
const refs=[...new Set(BOOK_CATALOG.filter(b=>b.id!=='tanakh').flatMap(b=>b.reference.split(/\s*;\s*/)))].filter(ref=>!only||ref===only);
if(!refs.length) throw new Error('No matching catalog reference');
const rows=[];
for(const ref of refs) {
  const entry=books[ref];
  const report={ref,...assessBook(entry),edition:entry?.version||null,localSha256:hash(entry?.hebrew||[])};
  if(online && entry?.version) {
    try {
      // Sefaria v1 pad=0 prevents silently receiving only the first chapter.
      // Explicit language/version path prevents silently merging different editions.
      const url=`https://www.sefaria.org/api/texts/${encodeURIComponent(ref)}/he/${encodeURIComponent(entry.version)}?pad=0&context=0&commentary=0`;
      const {response,data}=await requestJsonResponse(url,{timeoutMs:30000,headers:{Accept:'application/json'}});
      report.httpStatus=response.status;
      report.sourceUrl=url;
      if(!response.ok || !data || data.error) throw new Error(`Source unavailable (${response.status})`);
      if(canonical(data.ref)!==canonical(ref)) throw new Error(`Source returned another scope: ${data.ref}`);
      if(data.heVersionTitle!==entry.version) throw new Error('Exact stored edition was not returned');
      const remote=flattenText(data.he);
      if(!remote.some(text=>text.trim())) throw new Error('Empty source text');
      report.sourceReachable=true;
      report.remoteParagraphs=remote.length;
      report.remoteSha256=hash(remote);
      Object.assign(report,compareBookEdition(ref,entry,data));
      report.explanation='Comparison is to the named source edition, not certification that the publisher edition itself is complete.';
      if(report.completeness==='TEXT_OR_SCOPE_DIFF') {
        report.firstDifference=Array.from({length:Math.max(remote.length,entry.hebrew.length)},(_,i)=>i).find(i=>remote[i]!==entry.hebrew[i]);
      }
    } catch(error) {report.completeness='NOT_VERIFIED';report.error=error.message;}
    await new Promise(resolve=>setTimeout(resolve,600));
  }
  rows.push(report);
  console.log(`${report.completeness}\t${ref}\tlocal=${report.paragraphs}${report.remoteParagraphs!==undefined?` remote=${report.remoteParagraphs}`:''}`);
}
const gitDir=execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim();
const output=resolve(getArg('--output')||`${gitDir}/kazzohar-book-audit.json`);
await mkdir(resolve(output,'..'),{recursive:true});
const result={generatedAt:new Date().toISOString(),baseline:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),mode:online?'exact-edition-online':'local-structural-only',
  summary:{total:rows.length,matched:rows.filter(r=>r.completeness==='MATCHES_CURRENT_SOURCE_EDITION').length,different:rows.filter(r=>r.completeness==='TEXT_OR_SCOPE_DIFF').length,notVerified:rows.filter(r=>r.completeness==='NOT_VERIFIED').length},rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(`Report: ${output}`);
if(strict && rows.some(r=>r.completeness!=='MATCHES_CURRENT_SOURCE_EDITION'||r.issues.some(i=>!['missing-license','missing-edition'].includes(i)))) process.exitCode=1;
