const rl = require('./rl')

const myLog = {
    logSeperator: false,
    single (message) {
        rl.write(`\x1b[1A├───────────────────────────${this.logSeperator ? '┴' : '─'}───────────────────────────┤\n│ ${message} │\n└───────────────────────────────────────────────────────┘\n`)
        this.logSeperator = false
    },
    double (message1, message2) {
        rl.write(`\x1b[1A├───────────────────────────${this.logSeperator ? '┼' : '┬'}───────────────────────────┤\n│ ${message1} │ ${message2} │\n└───────────────────────────┴───────────────────────────┘\n`)
    }
}

module.exports = myLog
