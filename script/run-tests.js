const cp = require('child_process')

function runAllSpecs(files) {
  runSpecs(files, [])
}

function runSpecs(files, retries) {
  let env = process.env
  env.ATOM_JASMINE_REPORTER='list'
  if(retries.length > 0) {
    // Escape possible tests that can generate a regexp that will not match...
    const escaped = retries.map(str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    env.SPEC_FILTER = escaped.join("|")
  }
  const res = cp.spawn('yarn', ['start', '--test', ...files], {
    cwd: process.cwd(),
    env: env
  })

  let out;
  res.stdout.on('data', data => {
     process.stdout.write(data.toString());
  });

  res.stderr.on('data', data => {
     const strData = data.toString();
     process.stderr.write(strData);

     if(strData.match(/ALL TESTS THAT FAILED:/)) {
       out = '';
     } else if(out !== undefined) {
       out += strData;
     }
  });

  res.on('close', code => {
    if(code !== 0 && retries.length === 0) {
      const failed = filterSpecs(out)

      console.log(`*********************
Tests failed. Retrying failed tests...
*********************

`)

      console.log("failed.length is:")
      console.log(failed.length)

      if(failed.length === 0) {
        console.error("ERROR: We are re-running for failed tests, but the list of tests to re-run is empty!")
        console.error("This should never happen, but unfortunately it has, so there must be a bug in this script (run-tests.js).")
        console.error("Marking the CI job as 'failed'.")
        process.exit(1)
      }

      runSpecs(files, failed)
    } else {
      process.exit(code)
    }
  });
}

function filterSpecs(output) {
  if(!output) return ''
  let descriptions = []
  let start = true
  for(let out of output.split("\n")) {
    if(start) {
      if(out !== '') {
        start = false
        descriptions.push(out)
      }
    } else if(out !== '') {
      descriptions.push(out)
    } else {
      return descriptions
    }
  }
}

if(process.argv[0] === __filename) {
  runAllSpecs(process.argv.splice(1))
} else if(process.argv[1] === __filename) {
  runAllSpecs(process.argv.splice(2))
} else {
  module.exports = runAllSpecs
}
