import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const OFFICIAL_HASHES = {
  app: 'e87910d2b684011ebd71a7a212ca8bf33cd78280182457121f6fdffbd97d5c66',
  photoshop: '8680a48900eec08687dbf29c38ea2fd8f0265ebc99695908997120ba4f5107d3',
  sdk: '77bcee3c0e56d6a48acc07b49b1522b8d38574525ebe653f3db9b088447ba335',
};

const CONTENT_BRIDGE = `export { R, r, g, a, s, b, c, d, l, j, t } from './content.js';

const e = { Buffer: globalThis.Buffer };

function f(module) {
  if (Object.prototype.hasOwnProperty.call(module, '__esModule')) return module;
  const value = module.default;
  let result;
  if (typeof value === 'function') {
    result = function () {
      return this instanceof result
        ? Reflect.construct(value, arguments, this.constructor)
        : value.apply(this, arguments);
    };
    result.prototype = value.prototype;
  } else {
    result = {};
  }
  Object.defineProperty(result, '__esModule', { value: true });
  Object.keys(module).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(module, key);
    Object.defineProperty(result, key, descriptor.get ? descriptor : {
      enumerable: true,
      get: () => module[key],
    });
  });
  return result;
}

const _ = (loader) => loader();

export { e, f, _ };
`;

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function replaceOnce(content, search, replacement) {
  const first = content.indexOf(search);
  if (first < 0 || content.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Unexpected official 2.0 runtime shape: ${search}`);
  }
  return content.replace(search, replacement);
}

export function writeOfficialV2Runtime({ releaseRepo, pluginDir, webviewDir }) {
  const tempDir = mkdtempSync(join(tmpdir(), 'sdppp-v2-'));
  const archivePath = join(tempDir, 'sdppp2.zip');

  try {
    const archive = execFileSync(
      'git',
      ['-C', releaseRepo, 'show', 'HEAD:static/sd-ppp2_PS.zip'],
      { maxBuffer: 32 * 1024 * 1024 },
    );
    writeFileSync(archivePath, archive);

    const readEntry = (entry) => execFileSync(
      'unzip',
      ['-p', archivePath, entry],
      { maxBuffer: 32 * 1024 * 1024 },
    );

    const manifest = JSON.parse(readEntry('manifest.json').toString('utf8'));
    if (manifest.version !== '2.0.0') {
      throw new Error(`Expected official Photoshop runtime 2.0.0, got ${manifest.version}`);
    }

    const officialApp = readEntry('webview/App.js');
    const officialPhotoshop = readEntry('sdppp/photoshop.html');
    const officialSdk = readEntry('webview/sdppp-ps-sdk-chunk.js');

    for (const [name, content] of Object.entries({
      app: officialApp,
      photoshop: officialPhotoshop,
      sdk: officialSdk,
    })) {
      const actual = sha256(content);
      if (actual !== OFFICIAL_HASHES[name]) {
        throw new Error(`Official 2.0 ${name} hash mismatch: ${actual}`);
      }
    }

    let vendorApp = officialApp.toString('utf8');
    vendorApp = replaceOnce(
      vendorApp,
      'from"./content.js"',
      'from"./sdppp-v2-content-bridge.js"',
    );
    vendorApp = replaceOnce(
      vendorApp,
      'name:"main-store"',
      'name:"sdppp-v2-vendor-main-store"',
    );
    vendorApp = replaceOnce(
      vendorApp,
      'export{qMe as default};',
      'export{qMe as default,oAe as SponsorRenderer,P$e as RunningHubRenderer,mn as SponsorMainStore};',
    );

    writeFileSync(join(webviewDir, 'sdppp-v2-vendor.js'), vendorApp);
    writeFileSync(join(webviewDir, 'sdppp-v2-content-bridge.js'), CONTENT_BRIDGE);
    writeFileSync(join(webviewDir, 'sdppp-ps-sdk-chunk.js'), officialSdk);
    writeFileSync(join(pluginDir, 'sdppp/photoshop.html'), officialPhotoshop);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
