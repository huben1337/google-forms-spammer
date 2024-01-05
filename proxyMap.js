const { ProxyAgent } = require('undici')

const proxiesInfo = []

// read proxies
const fs = require('fs')
fs.readFileSync('./data/proxies.txt').toString().split(/\r?\n/).forEach(line => {
    const [proxyAddress, port, username, password] = line.split(':')
    proxiesInfo.push([proxyAddress, parseInt(port), username, password])
})

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
    }
}

// intialize proxies
let proxyId = 0
for (const [proxyAddress, port, username, password] of proxiesInfo) {
    const proxy = new ProxyWrapper(proxyAddress, port, username, password, proxyId)
    proxyMap.proxies.push(proxy)
    proxyId++
}
proxyMap.promotedProxy = proxyMap.proxies[0]

module.exports = proxyMap
