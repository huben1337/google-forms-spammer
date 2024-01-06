const { USE_PROXIES, FORM_URL, SPAMMER_PER_IP, SPAMMER_PER_IP_DEFAULT, NO_CONFIG_PROMPT } = require('./config')

if (!SPAMMER_PER_IP_DEFAULT || SPAMMER_PER_IP_DEFAULT < 1 || SPAMMER_PER_IP_DEFAULT > 100) {
    throw new Error('SPAMMER_PER_IP_DEFAULT must be a number between 1 and 100')
}

const { fetch } = require('undici')
const userAgents = require('./data/userAgents.json').filter(entry => entry.pct > 0.05)

const proxyMap = USE_PROXIES ? require('./utility/proxyMap') : null

const ipCount = (USE_PROXIES ? proxyMap.proxies.length : 1)

const rl = require('./utility/rl')
const myLog = require('./utility/myLog')

const getFormInfo = require('./lib/getFormInfo')
const generateResponseBody = require('./lib/generateResponse')

const formInfo = {
    responseParts: null,
    pageHistory: undefined,
    formId: undefined,
    type: undefined
}

const spammers = new Set()

let spammerCount = 0
let answerCount = 0
let lastAnswerCount = 0

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
        myLog.single(`Spammer started!${(' ').repeat(28 - spammerCountString.length)}Running: ${spammerCountString}`)
    }

    stop () {
        if (!this.disabled) return
        this.disabled = false
        spammerCount--
        const spammerCountString = spammerCount.toString()
        myLog.single(`Spammer stopped!${(' ').repeat(28 - spammerCountString.length)}Running: ${spammerCountString}`)
    }

    async submitAnswer () {
        try {
            const body = generateResponseBody[formInfo.type](formInfo.responseParts, formInfo.pageHistory)
            const UA = userAgents[Math.floor(Math.random() * userAgents.length)].ua
            const res = await fetch(`https://docs.google.com/forms/d/${formInfo.formId}/formResponse`, {
                credentials: 'include',
                headers: {
                    'User-Agent': UA,
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
            const buf = Buffer.from(await res.arrayBuffer())
            if (buf.length < 30000) {
                if (buf.includes('<script src="https://www.google.com/recaptcha/api.js" async defer></script>')) {
                    console.log('Blocked by recaptcha... try with different IP')
                    this.stop()
                    return
                }
            } else if (buf.subarray(18000, 36000).includes('/closedform')) {
                setImmediate(() => { restart() })
                return
            }
            if (this.noErrorCount > 5) {
                this.errorCount = 0
            }
            answerCount++
            setTimeout(() => { this.submitAnswer() }, 200 + Math.random() * 500)
        } catch (error) {
            this.errorCount++
            myLog.single('                                       Error occured!')
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
async function restart () {
    statrtingSpammers = true
    myLog.single('Restarting all spammers...                           ')
    for (const spammer of spammers.values()) {
        spammer.stop()
    }
    spammers.clear()
    const { responseParts, pageHistory, type } = await getFormInfo(formInfo.formId, true)
    formInfo.responseParts = responseParts
    formInfo.pageHistory = pageHistory
    formInfo.type = type
    for (let i = 0; i < spammerTargetCount; i++) {
        startSpammer()
    }
    statrtingSpammers = false
}

let spammerTargetCount = 0

async function start () {
    statrtingSpammers = true
    const { responseParts, pageHistory, type } = await getFormInfo(formInfo.formId)
    formInfo.responseParts = responseParts
    formInfo.pageHistory = pageHistory
    formInfo.type = type
    myLog.single('Starting all spammers...                             ')
    for (let i = 0; i < spammerTargetCount; i++) {
        startSpammer()
    }
    statrtingSpammers = false
}

async function promptConfig () {
    while (!formInfo.formId) {
        formInfo.formId = await new Promise((resolve) => {
            rl.question('Enter the form URL: ', (url) => {
                const match = url.match(/^https:\/\/docs\.google\.com\/forms\/d\/(e\/[0-9a-zA-Z_-]+)(?:\/[0-9a-zA-Z?=]*)?$/)
                if (match) {
                    resolve(match[1])
                    return
                }
                console.log('Please enter a valid form URL!')
                resolve(undefined)
            })
        })
    }
    while (spammerTargetCount === 0) {
        spammerTargetCount = await new Promise((resolve) => {
            rl.question(`Number of concurrent spammers per ip (default: ${SPAMMER_PER_IP_DEFAULT}): `, (answer) => {
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
}

(async () => {
    if (NO_CONFIG_PROMPT) {
        if (typeof FORM_URL !== 'string') throw new Error('FORM_URL must be a string')
        const match = FORM_URL.match(/^https:\/\/docs\.google\.com\/forms\/d\/(e\/[0-9a-zA-Z_-]+)(?:\/[0-9a-zA-Z?=]*)?$/)
        if (!match) throw new Error('FORM_URL must be a valid form URL starting with https://docs.google.com/forms/d/e/')
        formInfo.formId = match[1]
        if (typeof SPAMMER_PER_IP !== 'number') throw new Error('SPAMMER_PER_IP must be a number')
        if (!SPAMMER_PER_IP || SPAMMER_PER_IP < 1 || SPAMMER_PER_IP > 100) throw new Error('SPAMMER_PER_IP must be a number between 1 and 100')
        spammerTargetCount = SPAMMER_PER_IP * ipCount
    } else {
        if (FORM_URL) {
            if (typeof FORM_URL !== 'string') throw new Error('FORM_URL must be a string')
            const match = FORM_URL.match(/^https:\/\/docs\.google\.com\/forms\/d\/(e\/[0-9a-zA-Z_-]+)(?:\/[0-9a-zA-Z?=]*)?$/)
            if (!match) throw new Error('FORM_URL must be a valid form URL starting with https://docs.google.com/forms/d/e/')
            formInfo.formId = match[1]
        }
        await promptConfig()
    }

    rl.write('\n┌───────────────────────────────────────────────────────┐\n│ Log                                                   │\n└───────────────────────────────────────────────────────┘\n')

    await start()

    myLog.double('Δ Answers submitted delta', 'Σ Answers submitted total')
    setInterval(() => {
        const answersDeltaString = (answerCount - lastAnswerCount).toString()
        lastAnswerCount = answerCount
        const answersDeltaStringPadded = 'Δ' + (' ').repeat(24 - answersDeltaString.length) + answersDeltaString
        const answersTotalString = answerCount.toString()
        const answersTotalStringPadded = 'Σ' + (' ').repeat(24 - answersTotalString.length) + answersTotalString
        myLog.double(answersDeltaStringPadded, answersTotalStringPadded)
        if (!statrtingSpammers && spammerCount < spammerTargetCount) {
            startSpammer()
        }
    }, 500)
})()
