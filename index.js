const { USE_PROXIES, FORM_URL, SPAMMER_PER_IP, SPAMMER_PER_IP_DEFAULT, NO_CONFIG_PROMPT } = require('./config')

if (!SPAMMER_PER_IP_DEFAULT || SPAMMER_PER_IP_DEFAULT < 1 || SPAMMER_PER_IP_DEFAULT > 100) {
    throw new Error('SPAMMER_PER_IP_DEFAULT must be a number between 1 and 100')
}

const { fetch } = require('undici')

const proxyMap = USE_PROXIES ? require('./proxyMap') : null

const ipCount = (USE_PROXIES ? proxyMap.proxies.length : 1)

const userAgents = require('./userAgents.json')
const { getFormInfo } = require('./getFormInfo')
const { generateResponseBody } = require('./generateResponse')

const formInfo = {
    responseParts: null,
    pageHistory: undefined,
    formId: undefined,
    type: undefined
}

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})

const spammers = new Set()

let spammerCount = 0

let logSeperator = true
let answerCount = 0
let secondlatestAnswerId = 0

class Spammer {
    constructor (proxy) {
        this.proxy = proxy
    }

    proxy = null

    errorCount = 0
    noErrorCount = 0

    disabled = false

    start () {
        if (this.disabled) return
        this.disabled = true
        this.submitAnswer()
        spammerCount++
        const spammerCountString = spammerCount.toString()
        readline.write(`\x1b[0G│ Spammer started!${(' ').repeat(28 - spammerCountString.length)}Running: ${spammerCountString} │\n└───────────────────────────────────────────────────────┘`)
        logSeperator = false
    }

    stop () {
        if (!this.disabled) return
        this.disabled = false
        spammerCount--
        const spammerCountString = spammerCount.toString()
        readline.write(`\x1b[0G│ Spammer stopped!${(' ').repeat(28 - spammerCountString.length)}Running: ${spammerCountString} │\n└───────────────────────────────────────────────────────┘`)
        logSeperator = false
    }

    async submitAnswer () {
        try {
            const body = generateResponseBody[formInfo.type](formInfo.responseParts, formInfo.pageHistory)
            const res = await fetch(`https://docs.google.com/forms/d/${formInfo.formId}/formResponse`, {
                credentials: 'include',
                headers: {
                    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)].ua,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'de,en-US;q=0.7,en;q=0.3',
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Upgrade-Insecure-Requests': '1',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-User': '?1',
                    'Sec-GPC': '1',
                    Pragma: 'no-cache',
                    'Cache-Control': 'no-cache'
                },
                referrer: `https://docs.google.com/forms/d/${formInfo.formId}/formResponse`,
                body,
                method: 'POST',
                mode: 'cors',
                dispatcher: this.proxy
            })
            const text = await res.text()
            if (text.length < 30000) {
                if (text.includes('<script src="https://www.google.com/recaptcha/api.js" async defer></script>')) {
                    console.log('Blocked by recaptcha... try with different IP')
                    this.stop()
                    return
                }
            } else if (text.includes('nimmt keine Antworten mehr an', 25000)) {
                restart()
                return
            }
            if (this.noErrorCount > 5) {
                this.errorCount = 0
            }
            answerCount++
            setTimeout(() => { this.submitAnswer() }, 200 + Math.random() * 500)
        } catch (error) {
            this.errorCount++
            readline.write('\x1b[0G├───────────────────────────────────────────────────────┤\n│                                        Error occured! │\n└───────────────────────────────────────────────────────┘')
            logSeperator = false
            if (this.errorCount > 5) {
                this.stop()
                return
            }
            this.noErrorCount = 0
            setTimeout(() => { this.submitAnswer() }, 200 + Math.random() * 500)
        }
    }
}

function startSpammer () {
    const spammer = new Spammer(USE_PROXIES ? proxyMap.getProxy() : undefined)
    spammer.start()
    spammers.add(spammer)
}
let statrtingSpammers = false
function restart () {
    statrtingSpammers = true
    console.log('Restarting all spammers...')
    for (const spammer of spammers.values()) {
        spammer.stop()
    }
    spammers.clear()
    start()
}

let formUrl = FORM_URL
let spammerTargetCount = 0

async function start () {
    const { responseParts, pageHistory, formId, type } = await getFormInfo(formUrl)
    formInfo.responseParts = responseParts
    formInfo.pageHistory = pageHistory
    formInfo.formId = formId
    formInfo.type = type
    console.log('Starting all spammers...')
    console.log('┌───────────────────────────────────────────────────────┐')
    for (let i = 0; i < spammerTargetCount; i++) {
        startSpammer()
    }
    statrtingSpammers = false
}

async function promptConfig () {
    while (!formUrl) {
        formUrl = await new Promise((resolve) => {
            readline.question('Enter the form URL: ', resolve)
        })
    }
    while (spammerTargetCount === 0) {
        spammerTargetCount = await new Promise((resolve) => {
            readline.question(`Number of concurrent spammers per ip (default: ${SPAMMER_PER_IP_DEFAULT}): `, (answer) => {
                if (!answer) {
                    resolve(SPAMMER_PER_IP_DEFAULT * ipCount)
                    return
                }
                if (/^[1-9]{1,2}$/.test(answer)) {
                    resolve(parseInt(answer) * ipCount)
                    return
                }
                console.log('Please enter a number between 1 and 100!')
                resolve(0)
            })
        })
    }
    readline.close()
}

(async () => {
    if (NO_CONFIG_PROMPT) {
        if (!FORM_URL || typeof FORM_URL !== 'string') throw new Error('FORM_URL must be a string')
        if (!SPAMMER_PER_IP || SPAMMER_PER_IP < 1 || SPAMMER_PER_IP > 100) throw new Error('SPAMMER_PER_IP must be a number between 1 and 100')
        spammerTargetCount = SPAMMER_PER_IP * ipCount
    } else {
        await promptConfig()
    }

    await start()

    readline.write('\x1b[0G├───────────────────────────┬───────────────────────────┤\n│ Δ Answers submitted delta │ Σ Answers submitted total │\n')
    setInterval(() => {
        const answersDeltaString = (answerCount - secondlatestAnswerId).toString()
        secondlatestAnswerId = answerCount
        const answersDeltaStringPadded = 'Δ' + (' ').repeat(24 - answersDeltaString.length) + answersDeltaString
        const answersTotalString = answerCount.toString()
        const answersTotalStringPadded = 'Σ' + (' ').repeat(24 - answersTotalString.length) + answersTotalString
        if (logSeperator) {
            readline.write('\x1b[0G├───────────────────────────┼───────────────────────────┤\n')
        } else {
            readline.write('\x1b[0G├───────────────────────────┬───────────────────────────┤\n')
        }
        logSeperator = true
        readline.write(`│ ${answersDeltaStringPadded} │ ${answersTotalStringPadded} │\n└───────────────────────────┴───────────────────────────┘`)
        if (!statrtingSpammers && spammerCount < spammerTargetCount) {
            startSpammer()
        }
    }, 500)
})()
