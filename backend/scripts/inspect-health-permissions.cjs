const { execFileSync } = require("node:child_process");

const adb = "C:/Users/verma/AppData/Local/Android/Sdk/platform-tools/adb.exe";
const xml = execFileSync(adb, ["-s", "emulator-5554", "shell", "cat", "/sdcard/lifetrack-health-smoke.xml"], { encoding: "utf8" });
const nodes = [...xml.matchAll(/<node\b[^>]*>/g)].map(([tag]) => {
  const attributes = {};
  for (const [, key, value] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) attributes[key] = value;
  return attributes;
});
const visible = nodes
  .filter(node => /steps|background|allow|access|health connect/i.test(`${node.text} ${node["content-desc"]} ${node["resource-id"]}`))
  .map(node => ({ text: node.text, description: node["content-desc"], id: node["resource-id"], checked: node.checked, bounds: node.bounds }));
console.log(JSON.stringify(visible, null, 2));
