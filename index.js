'use strict';

/**
 * Module dependencies.
 */

var mocha = require('mocha')
var chalk = require('chalk')
var stripAnsi = require('strip-ansi')
var formatError = require('format-error').format;
var Base = mocha.reporters.Base
var inherits = mocha.utils.inherits
var color = Base.color

/**
 * Expose `Spec`.
 */

exports = module.exports = Spec

/**
 * Optional hook function; this will
 * wrap Mocha's standard functions into
 * a wrapper that will print the file and
 * line number at which the test can be found.
 */
function getFilenameAndLine() {
  var error = new Error()
  return error.stack
    .split('\n')
    .slice(3, 4)
    .pop()
    .split(process.cwd())
    .pop()
    .slice(1, -1)
}

function wrap(realFunc) {
  return function (label, func) {
    var line = getFilenameAndLine()
    realFunc(label, function () {
      console.log(chalk.cyan(line))
      return func.call(this)
    })
  }
}

var isHookActive = false
exports.hook = function () {
  isHookActive = true

  global.it = wrap(global.it)
  global.it.only = wrap(global.it.only)
  global.before = wrap(global.before)
  global.beforeEach = wrap(global.beforeEach)
  global.after = wrap(global.after)
  global.afterEach = wrap(global.afterEach)
};

/**
 * Initialize a new `Spec` test reporter.
 *
 * @param {Runner} runner
 */
function Spec(runner) {
  Base.call(this, runner)

  if (process.platform === 'win32') {
    Base.symbols.ok = '@'
    Base.symbols.pending = '?'
  } else {
    Base.symbols.ok = '✔'
    Base.symbols.pending = '⌗'
  }

  var indents = 0
  var n = 0

  function indent() {
    return Array(indents).join('  ')
  }

  // On windows, make sure that console writes to stdout
  // Note that the global console is NOT replacable; this is
  // why we need to replace all functions and attributes manually.
  // A hack, for sure.
  const c = new console.Console(process.stdout)
  for (let attr in console) {
    console[attr] = c[attr]
  }

  let oldStdout = process.stdout.write
  let oldStderr = process.stderr.write
  var interceptedOutput = []

  function createIntercept() {
    process.stdout.write = process.stderr.write = function (data) {
      interceptedOutput.push(data)
    }
  }

  function unhookIntercept() {
    process.stdout.write = oldStdout.bind(process.stdout)
    process.stderr.write = oldStderr.bind(process.stderr)
  }

  function clearLogStack() {
    interceptedOutput = []
  }

  function flushLogStack(indent) {
    if (interceptedOutput.length === 0) {
      return
    }

    var stripped = stripAnsi(interceptedOutput.join(''))

    if (stripped === '') {
      return clearLogStack()
    }

    var filenameLine = isHookActive
    var firstLine = true

    interceptedOutput.forEach(function (data) {
      let arr = data.toString().split('\n')
      arr.pop()

      // First line should always be the file name
      // printed by the hook
      if (filenameLine) {
        filenameLine = false
        console.log(indent + arr.shift())
      }

			// Add a space if more logs are to come
      if (firstLine) {
        firstLine = false
        if (interceptedOutput.length > 1 || arr.length > 0) {
          console.log()
        }
      }

      arr.forEach(function (line) {
        console.log(indent + chalk.blue('>>> logs: ') + line)
      })
    })
    console.log()

    clearLogStack()
  }

  function flushLogStackIfDebug(indent) {
    if (process.env.DEBUG) {
      flushLogStack(indent)
    } else {
      clearLogStack()
    }
  }

  function flushIfDebugAndResetIntercept(indent) {
    unhookIntercept()
    flushLogStackIfDebug(indent)
    createIntercept()
  }

  function humanizeMs(ms) {
    if (ms < 1000) {
      return ms + (ms === 1 ? ' millisecond' : ' milliseconds')
    }

    const date = new Date(ms)
    const hours = date.getUTCHours()
    const minutes = date.getUTCMinutes()
    const seconds = date.getUTCSeconds()

    let ret = ''

    if (hours) {
      ret += hours + (hours === 1 ? ' hour ' : ' hours ')
    }

    if (minutes || hours > 0) {
      ret += minutes + (minutes === 1 ? ' minute ' : ' minutes ')
    }

    ret += seconds + (seconds === 1 ? ' second ' : ' seconds ')

    return ret
  }


  runner.on('start', function () {
    console.log(chalk.reset(' '))
    createIntercept()
  })

  runner.on('suite', function (suite) {
    if (!suite.title) {
      return;
    }

    unhookIntercept()
    indents += 1
    flushLogStackIfDebug(indent())

    let colorize = chalk.magenta

    // For some reason, windows doesn't like magenta
    if (process.platform === 'win32') {
      colorize = colorize.bold
    }

    console.log(colorize('%s[%s]') + chalk.reset(' '), indent(), suite.title)

    createIntercept()
  })

  // We use this to add a spacing line between test blocks
  // for readability
  let someTestsRan = false

  runner.on('suite end', function () {
    unhookIntercept()
    flushLogStackIfDebug(indent())
    indents -= 1

    if (someTestsRan) {
      console.log()
    }
    someTestsRan = false

    createIntercept()
  })

  runner.on('test', function () {
    someTestsRan = true
    flushIfDebugAndResetIntercept(indent())
  })

  runner.on('pending', function (test) {
    someTestsRan = true

    unhookIntercept()
    var fmt = indent()
      + chalk.yellow('  ' + Base.symbols.pending)
      + color('pending', ' %s')

    console.log(fmt, test.title)

    createIntercept()
  })

  runner.on('pass', function (test) {
    unhookIntercept()

    var fmt
    if (test.speed === 'fast') {
      fmt = indent()
        + color('checkmark', '  ' + Base.symbols.ok)
        + color('pass', ' %s')
      console.log(fmt, test.title)
    } else {
      fmt = indent()
        + color('checkmark', '  ' + Base.symbols.ok)
        + color('pass', ' %s')
        + color(test.speed, ' (%dms)')
      console.log(fmt, test.title, test.duration)
    }

    flushLogStackIfDebug(indent() + '    ')
    createIntercept()
  })

  runner.on('fail', function (test) {
    // Delete powerassert-context if present
    if (test.err.powerAssertContext) {
      delete test.err.powerAssertContext
    }

    // Needed to append error at the bottom
    // of the stack we will be printing out
    let output = formatError(test.err)

    process.stdout.write(output + '\n')

    unhookIntercept()

    console.log()
    console.log(indent() + color('fail', '  %d) %s'), ++n, test.title)

    flushLogStack(indent() + '     ', 'reset')
    createIntercept()
  })

  runner.on('end', function () {
    let fmt
    let stats = this.stats
    let barColor = !stats.failures && 'green' || 'red'

    let topLine, bottomLine

    if (process.platform === 'win32') {
      topLine = '=============================================='
      bottomLine = '=============================================='
    } else {
      topLine = '▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀'
      bottomLine = '▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄'
    }

    unhookIntercept()
    flushLogStack('')

    console.log(chalk[barColor].bold(topLine))

    // passes
    fmt = chalk.bold(color('green', ' %d'))
      + color('green', ' passing')

    console.log(fmt, stats.passes || 0)

    // pending
    if (stats.pending) {
      fmt = chalk.bold(color('pending', ' %d'))
        + color('pending', ' pending')

      console.log(fmt, stats.pending)
    }

    // failures
    if (stats.failures) {
      fmt = chalk.bold(color('fail', ' %d'))
        + color('fail', ' failing')
      console.log(fmt, stats.failures)
    }

    fmt = chalk.gray(' Took ')
      + chalk.magenta.bold('%s')

    console.log(fmt, humanizeMs(stats.duration))

    console.log(chalk[barColor].bold(bottomLine))
    console.log()
  })
}

/**
 * Inherit from `Base.prototype`.
 */
inherits(Spec, Base)
