// Repeat in fresh processes/locales against native-generated synthetic inputs.
import {build} from 'esbuild';
import {mkdtemp,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const vault=resolve(process.argv[2]||'');
if(!process.argv[2] || !(await readFile(join(vault,'.murmuration-reports-fixture'),'utf8')).includes('Disposable synthetic'))throw Error('Supply a marked disposable native fixture vault');
const output=join(await mkdtemp('/tmp/reports-milestone-determinism-'),'run.mjs');
await build({stdin:{loader:'ts',resolveDir:process.cwd(),contents:`
import {readFile,readdir} from 'node:fs/promises';import {join} from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {readEditable} from './src/manager/DefinitionEditing';import {parseDerivedArtefactDefinition} from './src/core/DerivedArtefactDefinition';
import {normaliseLineChartData} from './src/core/LineChartData';import {renderLineChartSvg} from './src/core/LineChartSvg';
import {normaliseStateTableData} from './src/core/StateTableData';import {renderStateTableMarkdown} from './src/core/StateTableMarkdown';import {tableMarker} from './src/reports/OutputOwnership';
const vault=${JSON.stringify(vault)},hashes={};
for(const name of ['Publication','Explicit']) {
 const path='Definitions/'+name+'.md',fm=readEditable(await readFile(join(vault,path),'utf8')).data,d=parseDerivedArtefactDefinition(fm);
 const records=await Promise.all((await readdir(join(vault,d.source))).filter(n=>n.endsWith('.md')).map(async n=>({path:d.source+'/'+n,frontmatter:readEditable(await readFile(join(vault,d.source,n),'utf8')).data})));
 const content=d.artefactType==='line-chart'?renderLineChartSvg(normaliseLineChartData(d,records)):renderStateTableMarkdown(normaliseStateTableData(d,records))+'\\n'+tableMarker(path)+'\\n';
 assert.equal(content,await readFile(join(vault,d.output),'utf8'));hashes[d.output]=createHash('sha256').update(content).digest('hex');
}
console.log(JSON.stringify(hashes));
`},bundle:true,platform:'node',format:'esm',outfile:output,banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"}});
await import(pathToFileURL(output));
