const path = require('path')
const normalizePackageData = require('normalize-package-data');
const fs = require("fs/promises");

// Monkey-patch to not remove things I explicitly didn't say so
// See: https://github.com/electron-userland/electron-builder/issues/6957
let transformer = require('app-builder-lib/out/fileTransformer')
const builder_util_1 = require("builder-util");

transformer.createTransformer = function(srcDir, configuration, extraMetadata, extraTransformer) {
    const mainPackageJson = path.join(srcDir, "package.json");
    const isRemovePackageScripts = configuration.removePackageScripts !== false;
    const isRemovePackageKeywords = configuration.removePackageKeywords !== false;
    const packageJson = path.sep + "package.json";
    return file => {
        if (file === mainPackageJson) {
            return modifyMainPackageJson(file, extraMetadata, isRemovePackageScripts, isRemovePackageKeywords);
        }
        if (extraTransformer != null) {
            return extraTransformer(file);
        }
        else {
            return null;
        }
    };
}
async function modifyMainPackageJson(file, extraMetadata, isRemovePackageScripts, isRemovePackageKeywords) {
    const mainPackageData = JSON.parse(await fs.readFile(file, "utf-8"));
    if (extraMetadata != null) {
        builder_util_1.deepAssign(mainPackageData, extraMetadata);
        return JSON.stringify(mainPackageData, null, 2);
    }
    return null;
}
/// END Monkey-Patch

const builder = require("electron-builder")
const Platform = builder.Platform

const generate = require('./lib/generate-metadata.js')

let options = {
  "appId": "link.mauricioszabo.pulsar",
  "npmRebuild": false,
  "publish": null,
  "extraResources": [
    {
      "from": "apm",
      "to": "app/apm"
    }
  ],
  compression: "normal",
  "linux": {
    "icon": "resources/app-icons/atom-community.png",
    "category": "Development",
    "synopsis": "A hackable text editor for the 22nd century",
    "target": [
      {
        "target": "appimage",
        "arch": "x64"
      },
      {
        "target": "deb",
        "arch": "x64"
      },
      {
        "target": "rpm",
        "arch": "x64"
      }
    ]
  },
  "mac": {
    "icon": "resources/app-icons/atom-community.png",
    "category": "Development"
  },
  "win": {
    "icon": "resources/app-icons/atom-community.ico",
    "target": [
      { "target": "nsis" },
      { "target": "portable" }
    ]
  },
  "extraMetadata": {
  }
}

async function main() {
  const package = await fs.readFile('package.json', "utf-8")
  const packagesMeta = await packagesMetadata(package)
  // options.extraMetadata._atomPackages = packagesMeta
  builder.build({
    //targets: Platform.LINUX.createTarget(),
    config: options
  }).then((result) => {
    console.log("Built binaries")
    fs.mkdir('binaries').catch(() => "")
    Promise.all(result.map(r => fs.copyFile(r, path.join('binaries', path.basename(r)))))
  }).catch((error) => {
    console.error("Error building binaries")
    console.error(error)
    process.exit(1)
  })
}


async function packagesMetadata(package) {
  const parsed = JSON.parse(package)

  let packagesMetadata = []
  for(let name in parsed.packageDependencies) {
    const version = parsed.packageDependencies[name]
    packagesMetadata.push(readPackageData(name, version))
  }

  let metas = {}
  const allMetas = await Promise.all(packagesMetadata)
  allMetas.forEach(meta => {
    metas[meta.metadata.name] = meta
  })
  return metas
}

function readPackageData(name, version) {
  let filePath
  if(version.startsWith('file:')) {
    filePath = version.replace('file:./', '')
  } else {
    filePath = path.join('node_modules', name)
  }
  return readJSON(path.join(filePath, 'package.json'))
    .then(data => makeNormalizedPackage(data, filePath))
}


function makeNormalizedPackage(packageData, path) {
  normalizePackageData(packageData)

  const main = packageData.main
  let val = {
    metadata: packageData,
    // "keymaps": {},
    // "menus": {},
    // "grammarPaths": [],
    // "settings": {},
    "rootDirPath": path,

    // "styleSheetPaths": [
    //   "index.less"
    // ]
  }

  if(main) {
    val.main = `../node_modules/${packageData.name}/${main}`
  }

  return val;
}

function readJSON(file) {
  return fs.readFile(file, "utf-8").then(JSON.parse)
}

main()
