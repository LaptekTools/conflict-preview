// Dependency-free standalone build. Only replaces its own generated HTML output.
const fs = require('node:fs');
const path = require('node:path');
const template = fs.readFileSync(path.join(__dirname, 'page.template.html'), 'utf8');
const core = fs.readFileSync(path.join(__dirname, 'core.js'), 'utf8');
if (template.split('/* CORE */').length !== 2 || /<\/script/i.test(core)) throw new Error('Unexpected template/core');
const out = path.join(__dirname, 'conflict-preview.html');
const temp = out + '.' + process.pid + '.partial';
let descriptor;
try {
  descriptor = fs.openSync(temp, 'wx');
  fs.writeFileSync(descriptor, template.replace('/* CORE */', core));
  fs.fsyncSync(descriptor);
  fs.closeSync(descriptor); descriptor = undefined;
  fs.renameSync(temp, out);
} finally {
  if (descriptor !== undefined) fs.closeSync(descriptor);
  if (fs.existsSync(temp)) fs.unlinkSync(temp);
}
console.log('Built conflict-preview.html');
