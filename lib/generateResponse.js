function randFbzx (length) {
    let string = Math.random() < 0.5 ? '-' : ''
    for (let i = 0; i < length; i++) {
        string += Math.floor(Math.random() * 10).toString()
    }
    return string
}

const generateResponseBody = {
    multi: (responseParts, pageHistory) => {
        let response = ''
        const end = responseParts.length - 1
        for (let i = 0; i < end; i++) {
            response += `%5Bnull%2C${responseParts[i][0]}%2C%5B%22${responseParts[i][1]()}%22%5D%2C0%5D%2C`
            // response += responseParts[i]() + '%2C'
        }
        response += `%5Bnull%2C${responseParts[end][0]}%2C%5B%22${responseParts[end][1]()}%22%5D%2C0%5D`
        // response += responseParts[end]()
        const fbzx = randFbzx(19)
        return `fvv=1&partialResponse=%5B%5B${response}%5D%2Cnull%2C%22${fbzx}%22%5D&pageHistory=${pageHistory}&fbzx=${fbzx}`
    },

    single: (responseParts, pageHistory) => {
        let response = ''
        for (let i = 0; i < responseParts.length; i++) {
            const [id, getValue] = responseParts[i]
            response += `entry.${id}=${getValue()}&entry.${id}_sentinel=&`
            // response += responseParts[i]() + '%2C'
        }
        const fbzx = randFbzx(19)
        return `${response}fvv=1&partialResponse=%5Bnull` + `%2Cnull%2C%22${fbzx}%22%5D&pageHistory=${pageHistory}&fbzx=${fbzx}`
    }
}

module.exports = generateResponseBody
