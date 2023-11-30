function randFbzx (length) {
    let string = Math.random() < 0.5 ? '-' : ''
    for (let i = 0; i < length; i++) {
        string += Math.floor(Math.random() * 10).toString()
    }
    return string
}

function generateResponseBody (responseParts, pageHistory) {
    let body = ''
    const end = responseParts.length - 1
    for (let i = 0; i < end; i++) {
        body += responseParts[i]() + '%2C'
    }
    body += responseParts[end]()
    const fbzx = randFbzx(19)
    return `fvv=1&partialResponse=%5B${body}%2Cnull%2C%22${fbzx}%22%5D&pageHistory=${pageHistory}&fbzx=${fbzx}`
}

module.exports = {
    generateResponseBody
}
