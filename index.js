const { USE_PROXIES } = require('./config')

const { ProxyAgent, fetch } = require('undici')

const proxies = []

if (USE_PROXIES) {
    const fs = require('fs')
    fs.readFileSync('./data/proxies.txt').toString().split(/\r?\n/).forEach(line => {
        const [proxyAddress, port, username, password] = line.split(':')
        proxies.push([proxyAddress, parseInt(port), username, password])
    })
}

const userAgents = require('./userAgents.json')
const { getFormInfo } = require('./getFormInfo')
const { generateResponseBody } = require('./generateResponse')

const formInfo = {
    responseParts: null,
    pageHistory: undefined,
    formId: undefined
}

const spammers = new Set()

class ProxyWrapper extends ProxyAgent {
    constructor (proxyAddress, port, username, password, proxyId) {
        super({
            uri: `http://${proxyAddress}:${port}`,
            headers: {
                'Proxy-Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
            }
        })
        this.proxyAddress = proxyAddress
        this.proxyId = proxyId
    }

    proxyId = 0
    usedSlots = 0
}

const proxyMap = {
    proxies: [],
    promotedProxy: null,
    leastUsedSlots: 0,
    returnProxy (proxyId) {
        const proxy = this.proxies[proxyId]
        proxy.usedSlots--
        if (proxy.usedSlots < this.leastUsedSlots) {
            this.promotedProxy = proxy
            this.leastUsedSlots = proxy.usedSlots
        }
    },
    getProxy () {
        const proxy = this.promotedProxy
        proxy.usedSlots++
        this.leastUsedSlots++
        for (const proxy of this.proxies) {
            if (proxy.usedSlots < this.leastUsedSlots) {
                this.promotedProxy = proxy
                this.leastUsedSlots = proxy.usedSlots
            }
        }
        return proxy
    },
    init () {
        let proxyId = 0
        for (const [proxyAddress, port, username, password] of proxies) {
            const proxy = new ProxyWrapper(proxyAddress, port, username, password, proxyId)
            this.proxies.push(proxy)
            proxyId++
        }
        this.promotedProxy = this.proxies[0]
    }
}
if (USE_PROXIES) {
    proxyMap.init()
}

let spammerCount = 0

let logSeperator = false
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
        console.log('├───────────────────────────────────────────────────────┤\n│' + (' ').repeat(29 - spammerCountString.length) + 'Spammer started! Running: ' + spammerCountString + '│')
        logSeperator = true
    }

    stop () {
        if (!this.disabled) return
        this.disabled = false
        spammerCount--
        const spammerCountString = spammerCount.toString()
        console.log('├───────────────────────────────────────────────────────┤\n│' + (' ').repeat(29 - spammerCountString.length) + 'Spammer stopped! Running: ' + spammerCountString + '│')
        logSeperator = true
    }

    async submitAnswer () {
        try {
            const body = generateResponseBody(formInfo.responseParts, formInfo.pageHistory)
            const res = await fetch(`https://docs.google.com/forms/d/${formInfo.formId}/formResponse`, { // https://docs.google.com/forms/d/e/1FAIpQLSfIOvAXhZQelFPcvlk2Tp5y-1mEkaHporDmsNZEmRVWBJrvEA/formResponse
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
                referrer: 'https://docs.google.com/forms/d/e/1FAIpQLScB1hO6SQ65trVIYkJGvParbI6QnMa6zaPzw6uDTQTB9cvK-w/formResponse', //  'https://docs.google.com/forms/d/e/1FAIpQLSfIOvAXhZQelFPcvlk2Tp5y-1mEkaHporDmsNZEmRVWBJrvEA/formResponse'
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
                restartAllSpammers()
                return
            }
            if (this.noErrorCount > 5) {
                this.errorCount = 0
            }
            answerCount++
            setTimeout(() => { this.submitAnswer() }, 200 + Math.random() * 500)
        } catch (error) {
            this.errorCount++
            console.log('├───────────────────────────────────────────────────────┤\n│                                        Error occured! │')
            logSeperator = true
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
function restartAllSpammers () {
    statrtingSpammers = true
    console.log('Restarting all spammers...')
    for (const spammer of spammers.values()) {
        spammer.stop()
    }
    spammers.clear()
    startAllSpammers()
}

let SPAMMER_TARGET_COUNT = 0

async function startAllSpammers () {
    console.log('Getting form info...')
    const { responseParts, pageHistory, formId } = await getFormInfo('https://forms.gle/XBgqbuXGPDNVaKtr9') // https://forms.gle/MAtjXaRtCQmeEv2Q9
    formInfo.responseParts = responseParts
    formInfo.pageHistory = pageHistory
    formInfo.formId = formId
    console.log('Starting all spammers...')
    for (let i = 0; i < SPAMMER_TARGET_COUNT; i++) {
        startSpammer()
    }
    statrtingSpammers = false
}

(async () => {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    })
    while (true) {
        if (await new Promise((resolve) => {
            readline.question('Number of concurrent spammers per ip (default: 3): ', (answer) => {
                if (!answer) {
                    SPAMMER_TARGET_COUNT = 3 * (proxyMap.proxies.length || 1)
                    resolve(true)
                    return
                }
                const answerNumber = parseInt(answer)
                if (isNaN(answerNumber)) {
                    console.log('Please enter a number!')
                    resolve(false)
                    return
                }
                if (answerNumber < 1) {
                    console.log('Please enter a number greater than 0!')
                    resolve(false)
                    return
                }
                if (answerNumber > 100) {
                    console.log('Please enter a number less than 100!')
                    resolve(false)
                    return
                }
                SPAMMER_TARGET_COUNT = answerNumber
                resolve(true)
            })
        })) break
    }
    readline.close()

    await startAllSpammers()

    console.log('┌───────────────────────────┬───────────────────────────┐\n│ Δ Answers submitted delta │ Σ Answers submitted total │')
    setInterval(() => {
        const answersDeltaString = (answerCount - secondlatestAnswerId).toString()
        secondlatestAnswerId = answerCount
        const answersDeltaStringPadded = 'Δ' + (' ').repeat(24 - answersDeltaString.length) + answersDeltaString
        const answersTotalString = answerCount.toString()
        const answersTotalStringPadded = 'Σ' + (' ').repeat(24 - answersTotalString.length) + answersTotalString
        if (logSeperator) {
            console.log('├───────────────────────────┬───────────────────────────┤')
        } else {
            console.log('├───────────────────────────┼───────────────────────────┤')
        }
        logSeperator = false
        console.log(`│ ${answersDeltaStringPadded} │ ${answersTotalStringPadded} │`)
        if (!statrtingSpammers && spammerCount < SPAMMER_TARGET_COUNT) {
            startSpammer()
        }
    }, 500)
})()
