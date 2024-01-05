const fs = require('fs')

const formsCache = {}
const { USE_CACHE, TEXTFIELD_MODE } = require('./config')

async function saveCache (url, data) {
    if (!USE_CACHE) return
    for (const url in formsCache) {
        if (formsCache[url].ts < Date.now() - 1000 * 60 * 60) {
            delete formsCache[url]
        }
    }
    const cacheEntry = {
        ts: Date.now(),
        data
    }
    formsCache[url] = cacheEntry
    fs.writeFileSync('./data/cache.json', JSON.stringify(formsCache))
}

if (USE_CACHE) {
    // read cache
    if (fs.existsSync('./data')) {
        if (fs.existsSync('./data/cache.json')) {
            const cacheData = fs.readFileSync('./data/cache.json')
            if (cacheData.length > 0) {
                try {
                    const cache = JSON.parse(cacheData)
                    for (const url in cache) {
                        const item = cache[url]
                        if (item.ts < Date.now() - 1000 * 60 * 60) continue
                        formsCache[url] = item
                    }
                    fs.writeFileSync('./data/cache.json', JSON.stringify(formsCache))
                } catch {
                    console.log('Invalid cache.json ... clearing')
                    fs.writeFileSync('./data/cache.json', '')
                }
            }
        }
    } else {
        fs.mkdirSync('./data')
    }
}

const spewWords = [
    // empty
    () => '',
    // generate random string
    () => {
        const charSet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let string = ''
        for (let i = 0; i < 10; i++) {
            string += charSet[Math.floor(Math.random() * charSet.length)]
        }
        console.log(string)
        return string
    },
    require('./randomSentence')
][TEXTFIELD_MODE]
if (!spewWords) {
    throw new Error('Invalid TEXTFIELD_MODE')
}

function extractFormInfo (data) {
    const responseParts = []
    let pageCount = 0

    for (const item of data[1][1]) {
        const type = item[3]
        switch (type) {
        case 8:
        // log(`Page: ${item[1]}`)
            pageCount++
            break
        case 2: {
        // log(`Radio Select: ${item[1]}`)

            const encodedSelects = []
            for (const select of item[4][0][1]) {
                encodedSelects.push(encodeURIComponent(select[0]).replace(/%20/g, '+').replace(/%3D/g, '=').replace(/%26/g, '&'))
            }
            const id = item[4][0][0]
            // responseParts.push(() => `%5Bnull%2C${id}%2C%5B%22${encodedSelects[Math.floor(Math.random() * encodedSelects.length)]}%22%5D%2C0%5D`)
            responseParts.push([id, () => encodedSelects[Math.floor(Math.random() * encodedSelects.length)]])
            break
        }

        case 3: {
        // log(`Menu Select: ${item[1]}`)

            const encodedSelects = []
            for (const select of item[4][0][1]) {
                encodedSelects.push(encodeURIComponent(select[0]).replace(/%20/g, '+').replace(/%3D/g, '=').replace(/%26/g, '&'))
            }
            const id = item[4][0][0]
            // responseParts.push(() => `%5Bnull%2C${id}%2C%5B%22${encodedSelects[Math.floor(Math.random() * encodedSelects.length)]}%22%5D%2C0%5D`)
            responseParts.push([id, () => encodedSelects[Math.floor(Math.random() * encodedSelects.length)]])
            break
        }
        case 1: {
            const id = item[4][0][0]
            responseParts.push([id, spewWords])
            // responseParts.push(() => `%5Bnull%2C${id}%2C%5B%22${spewWords()}%22%5D%2C0%5D`)
        }
        }
    }
    let pageHistory = ''
    for (let i = 0; i < pageCount; i++) {
        pageHistory += `${i}%2C`
    }
    pageHistory += `${pageCount}`
    return {
        responseParts,
        pageHistory,
        formId: data[data.length - 5],
        type: pageCount === 0 ? 'single' : 'multi'
    }
}

async function getFormInfo (url, forceFetch = false) {
    console.log('Getting form info...')
    if (USE_CACHE && !forceFetch && formsCache[url]) {
        if (formsCache[url].ts < Date.now() - 1000 * 60 * 60) {
            delete formsCache[url]
        } else {
            console.log('Getting from cache...')
            return extractFormInfo(formsCache[url].data)
        }
    }

    // no cache
    console.log(`Fetching ${url}`)

    const res = await fetch(url, {
        credentials: 'omit',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'de,en-US;q=0.7,en;q=0.3',
            'Sec-GPC': '1',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            Pragma: 'no-cache',
            'Cache-Control': 'no-cache'
        },
        method: 'GET',
        mode: 'cors'
    })

    const text = await res.text()

    const dataStart = text.indexOf('FB_PUBLIC_LOAD_DATA_') + 23
    const dataEnd = text.indexOf(';</script>', dataStart)
    const data = JSON.parse(text.slice(dataStart, dataEnd))

    saveCache(url, data)

    return extractFormInfo(data)
}

module.exports = {
    getFormInfo
}
