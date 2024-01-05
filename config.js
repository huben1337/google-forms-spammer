const { TFM } = require('./constants')
module.exports = {
    USE_PROXIES: false,
    USE_CACHE: true,
    TEXTFIELD_MODE: TFM.EMPTY, // can be EMPTY, RANDOM_SENTENCE or RANDOM_STRING
    FORM_URL: '',
    SPAMMER_PER_IP: 3, // only used if NO_CONFIG_PROMPT is true
    SPAMMER_PER_IP_DEFAULT: 3,
    NO_CONFIG_PROMPT: false // if true no prompt will be shown
}
