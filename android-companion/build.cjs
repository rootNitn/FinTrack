const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const os = require('node:os');

const windows = process.platform === 'win32';
const home = os.homedir();
const env = { ...process.env };
const bundledJava = 'C:/Program Files/Android/Android Studio/jbr';
if (!env.JAVA_HOME && windows && fs.existsSync(bundledJava)) env.JAVA_HOME = bundledJava;
if (!env.ANDROID_HOME && windows) env.ANDROID_HOME = path.join(home, 'AppData/Local/Android/Sdk');
const targets = process.argv.slice(2);
const projectIndex = targets.indexOf('--project');
const projectDirectory = projectIndex >= 0 ? path.resolve(process.cwd(), targets[projectIndex + 1]) : __dirname;
if (projectIndex >= 0) targets.splice(projectIndex, 2);
if (projectIndex >= 0) {
  const toolchains = path.join(home, '.lifetrack', 'toolchains');
  const java21 = fs.existsSync(toolchains) ? fs.readdirSync(toolchains).find(name => name.startsWith('jdk-21') && fs.existsSync(path.join(toolchains, name, 'bin/java.exe'))) : null;
  if (java21) env.JAVA_HOME = path.join(toolchains, java21);
}
const wrapper = path.join(projectDirectory, windows ? 'gradlew.bat' : 'gradlew');
let executable = fs.existsSync(wrapper) ? wrapper : (windows ? 'gradle.bat' : 'gradle');
if (!fs.existsSync(wrapper)) {
  const cache = path.join(home, '.gradle/wrapper/dists/gradle-9.3.0-bin');
  if (fs.existsSync(cache)) {
    for (const folder of fs.readdirSync(cache)) {
      const candidate = path.join(cache, folder, 'gradle-9.3.0/bin', windows ? 'gradle.bat' : 'gradle');
      if (fs.existsSync(candidate)) executable = candidate;
    }
  }
}
const command = windows && executable.includes(' ') ? `"${executable}"` : executable;
const result = spawnSync(command, [...(targets.length ? targets : [':app:assembleDebug', ':app:testDebugUnitTest']), '--console=plain', '--no-daemon'], {
  cwd: projectDirectory, env, shell: windows, stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);