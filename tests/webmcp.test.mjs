import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../scripts/webmcp.js', import.meta.url), 'utf8');
function setup(api = 'document') {
  const tools = new Map();
  const navigations = [];
  const context = { document: {}, navigator: {}, URL, location: {
    origin: 'https://lisardbellod.com', assign: (url) => navigations.push(url),
  } };
  if (api) context[api].modelContext = { registerTool: (tool) => tools.set(tool.name, tool) };
  vm.runInNewContext(source, context);
  return { tools, navigations };
}

test('without WebMCP the script does not navigate or require other browser APIs', () => {
  const {tools, navigations} = setup(null);
  assert.equal(tools.size, 0);
  assert.deepEqual(navigations, []);
});

for (const api of ['document', 'navigator']) {
  test(`${api} integration lists real pages and restricts navigation to known sections`, async () => {
    const {tools, navigations} = setup(api);
    const sections = JSON.parse(await tools.get('list_site_sections').execute());
    assert.ok(sections.length > 0);
    for (const section of sections) {
      const url = new URL(section.url);
      assert.equal(url.origin, 'https://lisardbellod.com');
      const pathname = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
      assert.ok(fs.existsSync(new URL(`..${pathname}`, import.meta.url)));
      await tools.get('open_site_section').execute({section: section.section});
      assert.equal(navigations.at(-1), url.pathname);
    }
    const count = navigations.length;
    for (const section of ['__proto__', 'constructor', 'https://example.com', '../admin', null]) {
      await assert.rejects(tools.get('open_site_section').execute({section}), /Sección desconocida/);
    }
    assert.equal(navigations.length, count);
  });
}

test('blog queries round-trip as text without becoming paths or extra URL parameters', async () => {
  const {tools, navigations} = setup();
  const execute = tools.get('search_blog').execute;
  const query = '  eléctrico & q=otro #<script>  ';
  await execute({query});
  const url = new URL(navigations[0]);
  assert.equal(url.origin, 'https://lisardbellod.com');
  assert.equal(url.pathname, '/blog/');
  assert.equal(url.searchParams.get('q'), query.trim());
  assert.equal(url.searchParams.size, 1);
  assert.equal(url.hash, '');
  for (const query of ['', ' ', 'a', null, 123, 'a'.repeat(121)]) {
    await assert.rejects(execute({query}), /2 y 120/);
  }
  assert.equal(navigations.length, 1);
});
