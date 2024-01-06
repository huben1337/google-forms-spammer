function randomSentence () {
    return Math.random() < 0.5 ? 'Hi Mom!' : 'Hello World!'
}

module.exports = randomSentence
